/**
 * KYC / onboarding da conta autenticada (tag "Account Document") e a ação de
 * sandbox que aprova a conta (tag "Sandbox Actions").
 *
 * As duas coisas moram juntas porque são o MESMO fluxo: o cliente lista os
 * documentos pendentes, envia os arquivos, e a conta é aprovada. (As ações de
 * sandbox de COBRANÇA moram em `payments/handlers.ts` — cada ação de sandbox fica
 * ao lado do recurso que ela move, não numa pasta "sandbox" que junta domínios
 * que não conversam.)
 *
 * Nenhuma das três operações recebe id de conta: o recurso é sempre
 * `auth.accountId`.
 */
import { and, eq } from 'drizzle-orm'
import { invalid, notFound } from '../../core/errors.ts'
import type { DB } from '../../db/client.ts'
import { accounts } from '../../db/schema/accounts.ts'
import { accountDocuments } from '../../db/schema/account-documents.ts'
import type { HandlerMap } from '../../http/register.ts'
import {
  approveAccountDocuments,
  approveDocument,
  documentationStatus,
  listDocumentGroups,
} from './service.ts'

/**
 * O nome do arquivo enviado. Em multipart o Elysia entrega um `File`; se alguém
 * mandar JSON (a validação de schema não roda em multipart — ver `register.ts`),
 * chega uma string.
 */
function fileNameOf(value: unknown): string | null {
  if (value instanceof File) return value.name
  if (typeof value === 'string' && value !== '') return value
  return null
}

export const accountDocumentHandlers: HandlerMap = {
  'check-pending-documents': async ({ ctx, auth }) => {
    return listDocumentGroups(ctx.db, auth.accountId)
  },

  /**
   * `POST /v3/myAccount/documents/{id}` — multipart/form-data, campo
   * `documentFile`. O `{id}` é o do DOCUMENTO (o que veio em `group.documents[]`),
   * não o do grupo.
   *
   * Em sandbox qualquer arquivo é aceito e aprovado na hora: o documento vira
   * APPROVED e, se era o último pendente do grupo, o grupo também.
   */
  'send-documents': async ({ ctx, auth, params, body }) => {
    const b = (body ?? {}) as Record<string, unknown>

    // multipart não passa pela validação de schema do Elysia (o TypeBox do JSON
    // não descreve um File), então o obrigatório é conferido aqui.
    if (b.documentFile === undefined || b.documentFile === null || b.documentFile === '') {
      throw invalid('documentFile', 'O arquivo do documento é obrigatório.')
    }

    const [doc] = await ctx.db
      .select()
      .from(accountDocuments)
      .where(
        and(
          eq(accountDocuments.id, params.id!),
          eq(accountDocuments.accountId, auth.accountId),
        ),
      )
      .limit(1)

    if (!doc) throw notFound('Documento')

    const now = ctx.clock.timestamp()
    await ctx.db.transaction(async (tx) => {
      await approveDocument(tx as unknown as DB, doc, fileNameOf(b.documentFile), now)
    })

    // O campo `type` do request só faria sentido para criar um documento novo num
    // grupo CUSTOM; aqui o documento já existe e o grupo define o tipo.
    return { id: doc.id, status: 'APPROVED' }
  },

  /**
   * `POST /v3/sandbox/myAccount/approve` — aprova a conta autenticada.
   * Devolve o mesmo corpo de `GET /v3/myAccount/status`, já com o efeito
   * aplicado: é o que permite ao cliente confirmar a aprovação sem uma segunda
   * chamada.
   */
  'approve-account': async ({ ctx, auth }) => {
    const now = ctx.clock.timestamp()

    await ctx.db.transaction(async (tx) => {
      await tx
        .update(accounts)
        .set({ status: 'APPROVED' })
        .where(eq(accounts.id, auth.accountId))

      await approveAccountDocuments(tx as unknown as DB, auth.accountId, now)
    })

    const documentation = await documentationStatus(ctx.db, auth.accountId)

    return {
      id: auth.accountId,
      commercialInfo: 'APPROVED',
      bankAccountInfo: 'APPROVED',
      documentation: documentation ?? 'APPROVED',
      general: 'APPROVED',
    }
  },
}

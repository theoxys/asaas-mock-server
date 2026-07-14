/**
 * KYC: criação, aprovação e serialização dos documentos de uma conta.
 *
 * Fica num serviço, e não só nos handlers, porque quem CRIA os grupos não é uma
 * rota: é o nascimento de uma conta (seed da conta principal e
 * `POST /v3/accounts`). Uma subconta que nascesse sem grupo pendente não teria o
 * que enviar, e o fluxo de KYC do cliente pararia no primeiro passo.
 */
import { and, eq, ne } from 'drizzle-orm'
import type { Clock } from '../../core/clock.ts'
import type { Config } from '../../core/config.ts'
import type { Rng } from '../../core/rng.ts'
import type { DB } from '../../db/client.ts'
import { accountDocumentGroups, accountDocuments } from '../../db/schema/account-documents.ts'
import { addDays } from '../../domain/calendar.ts'
import * as ids from '../../domain/ids.ts'

type GroupRow = typeof accountDocumentGroups.$inferSelect
type DocumentRow = typeof accountDocuments.$inferSelect

export interface DocumentDeps {
  clock: Clock
  rng: Rng
  config: Config
}

/**
 * O grupo com que toda conta nasce. Título e descrição são os que o sandbox real
 * devolve — não são texto inventado.
 *
 * TODO(regra): o Asaas real varia os grupos conforme o tipo de pessoa e o tipo de
 * empresa (contrato social para LTDA, certificado do MEI…). Não capturamos uma
 * conta não-aprovada, então modelamos UM grupo, o de identificação, que é o único
 * que existe em toda conta. Criar mais grupos seria inventar.
 */
const IDENTIFICATION_GROUP = {
  type: 'IDENTIFICATION',
  title: 'Documentos de identificação',
  description:
    'Para enviar esse documento acesse nosso aplicativo ou utilize o link de onboarding.',
} as const

/** TODO(regra): a doc não diz por quanto tempo o link de onboarding vale. */
const ONBOARDING_URL_TTL_DAYS = 30

/**
 * Quem responde pelos documentos, derivado do cadastro da conta.
 *
 * TODO(regra): só temos captura de UMA conta (JURIDICA, `INDIVIDUAL_COMPANY`). O
 * resto do mapa é dedução do enum `AccountDocumentResponsibleType` da spec.
 */
export function responsibleTypeFor(
  personType: string,
  companyType: string | null,
): string {
  if (personType === 'FISICA') return 'ASAAS_ACCOUNT_OWNER'

  switch (companyType) {
    case 'MEI':
      return 'MEI'
    case 'LIMITED':
      return 'LIMITED_COMPANY'
    case 'ASSOCIATION':
      return 'ASSOCIATION'
    default:
      return 'INDIVIDUAL_COMPANY'
  }
}

export interface NewAccountDocuments {
  accountId: string
  name: string
  personType: string
  companyType: string | null
  /** Conta principal (seed) nasce aprovada; subconta nasce com KYC pendente. */
  approved: boolean
}

/**
 * Cria os grupos/documentos de uma conta recém-criada. Chame DENTRO da transação
 * que cria a conta.
 */
export async function createAccountDocuments(
  tx: DB,
  deps: DocumentDeps,
  account: NewAccountDocuments,
): Promise<void> {
  const now = deps.clock.timestamp()
  const groupId = ids.genericId(deps.rng)
  const approved = account.approved

  await tx.insert(accountDocumentGroups).values({
    id: groupId,
    accountId: account.accountId,
    type: IDENTIFICATION_GROUP.type,
    title: IDENTIFICATION_GROUP.title,
    description: IDENTIFICATION_GROUP.description,
    status: approved ? 'APPROVED' : 'NOT_SENT',
    responsibleName: account.name,
    responsibleType: responsibleTypeFor(account.personType, account.companyType),
    // O link só existe enquanto há o que enviar — no grupo aprovado o sandbox
    // real devolve `onboardingUrl: null`.
    onboardingUrl: approved ? null : onboardingUrl(deps),
    onboardingUrlExpirationDate: approved
      ? null
      : `${addDays(deps.clock.today(), ONBOARDING_URL_TTL_DAYS)} 00:00:00`,
    dateCreated: now,
  })

  await tx.insert(accountDocuments).values({
    id: ids.genericId(deps.rng),
    groupId,
    accountId: account.accountId,
    status: approved ? 'APPROVED' : 'NOT_SENT',
    fileName: null,
    sentAt: approved ? now : null,
    dateCreated: now,
  })
}

function onboardingUrl(deps: DocumentDeps): string {
  return `${deps.config.publicBaseUrl}/onboarding/${deps.rng.hex(32)}`
}

/** Aprova todos os documentos e grupos da conta. Usado pela ação de sandbox. */
export async function approveAccountDocuments(
  tx: DB,
  accountId: string,
  now: string,
): Promise<void> {
  await tx
    .update(accountDocuments)
    .set({ status: 'APPROVED', sentAt: now })
    .where(and(eq(accountDocuments.accountId, accountId), ne(accountDocuments.status, 'APPROVED')))

  await tx
    .update(accountDocumentGroups)
    .set({ status: 'APPROVED', onboardingUrl: null, onboardingUrlExpirationDate: null })
    .where(
      and(
        eq(accountDocumentGroups.accountId, accountId),
        ne(accountDocumentGroups.status, 'APPROVED'),
      ),
    )
}

/**
 * Aprova o documento e, se ele era o último pendente, o grupo inteiro.
 * Em sandbox qualquer arquivo é aceito — não há análise a esperar.
 */
export async function approveDocument(
  tx: DB,
  doc: DocumentRow,
  fileName: string | null,
  now: string,
): Promise<void> {
  await tx
    .update(accountDocuments)
    .set({ status: 'APPROVED', fileName, sentAt: now })
    .where(eq(accountDocuments.id, doc.id))

  const pending = await tx
    .select({ id: accountDocuments.id })
    .from(accountDocuments)
    .where(
      and(eq(accountDocuments.groupId, doc.groupId), ne(accountDocuments.status, 'APPROVED')),
    )

  if (pending.length > 0) return

  await tx
    .update(accountDocumentGroups)
    .set({ status: 'APPROVED', onboardingUrl: null, onboardingUrlExpirationDate: null })
    .where(eq(accountDocumentGroups.id, doc.groupId))
}

/**
 * O status da documentação da conta, para `GET /v3/myAccount/status`.
 *
 * `null` = a conta não tem grupo nenhum (banco criado antes desta tabela); quem
 * chama cai de volta no status da conta em vez de reprovar a conta em silêncio.
 */
export async function documentationStatus(
  db: DB,
  accountId: string,
): Promise<'APPROVED' | 'PENDING' | null> {
  const groups = await db
    .select({ status: accountDocumentGroups.status })
    .from(accountDocumentGroups)
    .where(eq(accountDocumentGroups.accountId, accountId))

  if (groups.length === 0) return null

  const done = groups.every((g) => g.status === 'APPROVED' || g.status === 'IGNORED')
  return done ? 'APPROVED' : 'PENDING'
}

/**
 * A resposta de `GET /v3/myAccount/documents`, no formato capturado do sandbox.
 *
 * Duas coisas que o formato real faz e que um serializador ingênuo erraria:
 *
 * 1. o grupo APPROVED NÃO traz o array `documents` nem
 *    `onboardingUrlExpirationDate` — só `onboardingUrl: null`;
 * 2. `responsible.type` é uma STRING, não um array. A spec declara array; a
 *    captura do sandbox desmente. O golden ganha (AGENTS.md).
 */
export async function listDocumentGroups(db: DB, accountId: string) {
  const groups = await db
    .select()
    .from(accountDocumentGroups)
    .where(eq(accountDocumentGroups.accountId, accountId))

  const docs = await db
    .select()
    .from(accountDocuments)
    .where(eq(accountDocuments.accountId, accountId))

  return {
    // TODO(regra): nunca reprovamos uma conta em sandbox, então não há motivo de
    // recusa a informar.
    rejectReasons: null,
    data: groups.map((g) => serializeGroup(g, docs.filter((d) => d.groupId === g.id))),
  }
}

function serializeGroup(g: GroupRow, docs: DocumentRow[]): Record<string, unknown> {
  const group: Record<string, unknown> = {
    id: g.id,
    status: g.status,
    type: g.type,
    title: g.title,
    description: g.description,
    responsible: { name: g.responsibleName, type: g.responsibleType },
    onboardingUrl: g.onboardingUrl,
  }

  if (g.status === 'APPROVED') return group

  group.onboardingUrlExpirationDate = g.onboardingUrlExpirationDate
  group.documents = docs.map((d) => ({ id: d.id, status: d.status }))
  return group
}

/**
 * Track G1 — Credit Bureau Report (3 operações).
 *
 * Consulta ao Serasa. Duas assimetrias da API do Asaas que reproduzimos:
 *
 * 1. `reportFile` (o PDF em base64) só vem na resposta da CRIAÇÃO. Na leitura e
 *    na listagem ele é null — quem quiser o arquivo depois usa o `downloadUrl`.
 * 2. `dateCreated` aqui é DATA (YYYY-MM-DD), não timestamp.
 *
 * A taxa da consulta é gravada em `feeCents` a partir de `config.fees`, mas NÃO é
 * debitada do saldo: não existe um tipo de lançamento do Asaas para ela que a
 * gente conheça, e inventar um tipo no extrato seria pior que não lançar. Está
 * anotado em progress.md — é o track D que fecha isso.
 */
import { and, count, desc, eq, gte, lte } from 'drizzle-orm'
import { invalid, notFound } from '../../core/errors.ts'
import { listEnvelope, paginationParams } from '../../core/pagination.ts'
import { customers } from '../../db/schema/customers.ts'
import { creditBureauReports } from '../../db/schema/misc.ts'
import { isValidCpfCnpj, personTypeOf } from '../../domain/cpf-cnpj.ts'
import { creditBureauReportId } from '../../domain/ids.ts'
import type { HandlerMap } from '../../http/register.ts'

type ReportRow = typeof creditBureauReports.$inferSelect

const DATE = /^\d{4}-\d{2}-\d{2}$/

function serialize(
  row: ReportRow,
  baseUrl: string,
  opts: { withFile: boolean } = { withFile: false },
) {
  return {
    id: row.id,
    // A spec devolve só a data — o timestamp fica no banco.
    dateCreated: row.dateCreated.slice(0, 10),
    cpfCnpj: row.cpfCnpj ?? null,
    customer: row.customerId ?? null,
    downloadUrl: `${baseUrl}/creditBureauReport/download/${row.id}`,
    reportFile: opts.withFile ? row.reportFile : null,
  }
}

export const creditBureauHandlers: HandlerMap = {
  'make-consultation': async ({ ctx, auth, body }) => {
    const b = (body ?? {}) as { customer?: string | null; cpfCnpj?: string | null }

    if (!b.customer && !b.cpfCnpj) {
      throw invalid(
        'cpfCnpj',
        'Informe o cliente (customer) ou o CPF/CNPJ a ser consultado.',
      )
    }

    let customerId: string | null = null
    let cpfCnpj: string | null = null

    if (b.customer) {
      const [customer] = await ctx.db
        .select()
        .from(customers)
        .where(and(eq(customers.id, b.customer), eq(customers.accountId, auth.accountId)))
        .limit(1)

      if (!customer) throw notFound('Cliente')
      customerId = customer.id
      // O documento consultado é o do cliente — o que estiver no body é ignorado,
      // como no Asaas.
      cpfCnpj = customer.cpfCnpj
    } else {
      cpfCnpj = String(b.cpfCnpj)
      if (!isValidCpfCnpj(cpfCnpj)) {
        throw invalid('cpfCnpj', 'O CPF/CNPJ informado é inválido.')
      }
    }

    const fee =
      personTypeOf(cpfCnpj) === 'JURIDICA'
        ? ctx.config.fees.creditBureauReport.legalPerson
        : ctx.config.fees.creditBureauReport.naturalPerson

    const id = creditBureauReportId(ctx.rng)
    const row = {
      id,
      accountId: auth.accountId,
      customerId,
      cpfCnpj,
      state: null,
      status: 'AVAILABLE',
      feeCents: fee,
      reportFile: Buffer.from(
        `%PDF-1.4 relatorio-serasa ${cpfCnpj} ${ctx.clock.today()}`,
      ).toString('base64'),
      dateCreated: ctx.clock.timestamp(),
    }

    await ctx.db.insert(creditBureauReports).values(row)

    // reportFile só existe AQUI, na criação.
    return serialize(row as ReportRow, ctx.config.publicBaseUrl, { withFile: true })
  },

  'retrieve-a-credit-bureau-report': async ({ ctx, auth, params }) => {
    const [row] = await ctx.db
      .select()
      .from(creditBureauReports)
      .where(
        and(
          eq(creditBureauReports.id, params.id!),
          eq(creditBureauReports.accountId, auth.accountId),
        ),
      )
      .limit(1)

    if (!row) throw notFound('Relatório de crédito')
    return serialize(row, ctx.config.publicBaseUrl)
  },

  'list-credit-bureau-reports': async ({ ctx, auth, query }) => {
    const { limit, offset } = paginationParams(query)

    const filters = [eq(creditBureauReports.accountId, auth.accountId)]

    // dateCreated é 'YYYY-MM-DD HH:mm:ss': comparar com 'YYYY-MM-DD' funciona
    // lexicograficamente para o início e precisa de um sufixo para o fim.
    if (typeof query.startDate === 'string' && query.startDate !== '') {
      if (!DATE.test(query.startDate)) {
        throw invalid('startDate', 'A data inicial deve estar no formato YYYY-MM-DD.')
      }
      filters.push(gte(creditBureauReports.dateCreated, query.startDate))
    }
    if (typeof query.endDate === 'string' && query.endDate !== '') {
      if (!DATE.test(query.endDate)) {
        throw invalid('endDate', 'A data final deve estar no formato YYYY-MM-DD.')
      }
      filters.push(lte(creditBureauReports.dateCreated, `${query.endDate} 23:59:59`))
    }

    const where = and(...filters)

    const [{ total } = { total: 0 }] = await ctx.db
      .select({ total: count() })
      .from(creditBureauReports)
      .where(where)

    const rows = await ctx.db
      .select()
      .from(creditBureauReports)
      .where(where)
      .orderBy(desc(creditBureauReports.dateCreated), desc(creditBureauReports.id))
      .limit(limit)
      .offset(offset)

    return listEnvelope(
      rows.map((r) => serialize(r, ctx.config.publicBaseUrl)),
      total,
      limit,
      offset,
    )
  },
}

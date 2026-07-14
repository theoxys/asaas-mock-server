import { and, count, eq, like } from 'drizzle-orm'
import type { AppContext, AuthContext } from '../../core/context.ts'
import { badRequest, invalid, notFound } from '../../core/errors.ts'
import { listEnvelope, paginationParams } from '../../core/pagination.ts'
import type { HandlerMap } from '../../http/register.ts'
import { customers } from '../../db/schema/index.ts'
import { isValidCpfCnpj, isValidMobilePhone, personTypeOf } from '../../domain/cpf-cnpj.ts'
import * as ids from '../../domain/ids.ts'

type CustomerRow = typeof customers.$inferSelect

function serialize(c: CustomerRow): Record<string, unknown> {
  return {
    object: 'customer',
    id: c.id,
    dateCreated: c.dateCreated,
    name: c.name,
    email: c.email,
    company: c.company,
    phone: c.phone,
    mobilePhone: c.mobilePhone,
    address: c.address,
    addressNumber: c.addressNumber,
    complement: c.complement,
    province: c.province,
    postalCode: c.postalCode,
    cpfCnpj: c.cpfCnpj,
    personType: c.personType,
    deleted: c.deleted,
    additionalEmails: c.additionalEmails,
    externalReference: c.externalReference,
    notificationDisabled: c.notificationDisabled,
    observations: c.observations,
    municipalInscription: c.municipalInscription,
    stateInscription: c.stateInscription,
    canDelete: !c.deleted,
    cannotBeDeletedReason: null,
    canEdit: true,
    cannotEditReason: null,
    city: c.city === null ? null : Number(c.city),
    cityName: c.cityName,
    state: c.state,
    country: c.country,
  }
}

async function findOwned(ctx: AppContext, auth: AuthContext, id: string): Promise<CustomerRow> {
  const [row] = await ctx.db
    .select()
    .from(customers)
    // Isolamento por conta: um cliente de outra conta simplesmente não existe.
    .where(and(eq(customers.id, id), eq(customers.accountId, auth.accountId)))
    .limit(1)

  if (!row) throw notFound('Cliente')
  return row
}

export const customerHandlers: HandlerMap = {
  'create-new-customer': async ({ ctx, auth, body }) => {
    const b = body as Record<string, any>

    // O Asaas valida o dígito verificador de verdade. Um mock que aceita
    // "11111111111" esconde um bug que só aparece em produção.
    //
    // O código é `invalid_object`, NÃO `invalid_cpfCnpj` — parece errado, mas é
    // exatamente o que o sandbox real devolve. Provado pela captura de paridade.
    if (!isValidCpfCnpj(String(b.cpfCnpj ?? ''))) {
      throw badRequest('invalid_object', 'O CPF/CNPJ informado é inválido.')
    }

    // O Asaas recusa celular com dígitos todos iguais (47999999999).
    if (b.mobilePhone !== undefined && b.mobilePhone !== null && b.mobilePhone !== '') {
      if (!isValidMobilePhone(String(b.mobilePhone))) {
        throw invalid('mobilePhone', 'O celular informado é inválido.')
      }
    }

    const id = ids.customerId(ctx.rng)
    const row: CustomerRow = {
      id,
      accountId: auth.accountId,
      name: b.name,
      cpfCnpj: String(b.cpfCnpj).replace(/\D/g, ''),
      personType: personTypeOf(String(b.cpfCnpj)),
      email: b.email ?? null,
      phone: b.phone ?? null,
      mobilePhone: b.mobilePhone ?? null,
      address: b.address ?? null,
      addressNumber: b.addressNumber ?? null,
      complement: b.complement ?? null,
      province: b.province ?? null,
      postalCode: b.postalCode ?? null,
      city: null,
      cityName: null,
      state: null,
      country: 'Brasil',
      externalReference: b.externalReference ?? null,
      notificationDisabled: b.notificationDisabled ?? false,
      additionalEmails: b.additionalEmails ?? null,
      municipalInscription: b.municipalInscription ?? null,
      stateInscription: b.stateInscription ?? null,
      observations: b.observations ?? null,
      groupName: b.groupName ?? null,
      company: b.company ?? null,
      foreignCustomer: b.foreignCustomer ?? false,
      deleted: false,
      dateCreated: ctx.clock.today(),
    }

    await ctx.db.insert(customers).values(row)
    return serialize(row) // HTTP 200, não 201 — o Asaas nunca devolve 201.
  },

  'list-customers': async ({ ctx, auth, query }) => {
    const { limit, offset } = paginationParams(query)

    const filters = [eq(customers.accountId, auth.accountId)]
    if (query.name) filters.push(like(customers.name, `%${String(query.name)}%`))
    if (query.email) filters.push(eq(customers.email, String(query.email)))
    if (query.cpfCnpj) {
      filters.push(eq(customers.cpfCnpj, String(query.cpfCnpj).replace(/\D/g, '')))
    }
    if (query.externalReference) {
      filters.push(eq(customers.externalReference, String(query.externalReference)))
    }
    if (query.groupName) filters.push(eq(customers.groupName, String(query.groupName)))
    if (query.deletedOnly === 'true' || query.deletedOnly === true) {
      filters.push(eq(customers.deleted, true))
    } else if (!(query.includeDeleted === 'true' || query.includeDeleted === true)) {
      filters.push(eq(customers.deleted, false))
    }

    const where = and(...filters)

    const [totalRow] = await ctx.db.select({ total: count() }).from(customers).where(where)
    const total = totalRow?.total ?? 0

    const rows = await ctx.db
      .select()
      .from(customers)
      .where(where)
      .limit(limit)
      .offset(offset)

    return listEnvelope(rows.map(serialize), total ?? 0, limit, offset)
  },

  'retrieve-a-single-customer': async ({ ctx, auth, params }) =>
    serialize(await findOwned(ctx, auth, params.id!)),

  'update-existing-customer': async ({ ctx, auth, params, body }) => {
    const existing = await findOwned(ctx, auth, params.id!)
    const b = body as Record<string, any>

    if (b.cpfCnpj !== undefined && !isValidCpfCnpj(String(b.cpfCnpj))) {
      throw badRequest('invalid_object', 'O CPF/CNPJ informado é inválido.')
    }

    if (b.mobilePhone !== undefined && b.mobilePhone !== null && b.mobilePhone !== '') {
      if (!isValidMobilePhone(String(b.mobilePhone))) {
        throw invalid('mobilePhone', 'O celular informado é inválido.')
      }
    }

    const patch: Partial<CustomerRow> = {}
    const copy = [
      'name',
      'email',
      'phone',
      'mobilePhone',
      'address',
      'addressNumber',
      'complement',
      'province',
      'postalCode',
      'externalReference',
      'notificationDisabled',
      'additionalEmails',
      'municipalInscription',
      'stateInscription',
      'observations',
      'groupName',
      'company',
    ] as const

    for (const k of copy) if (b[k] !== undefined) (patch as any)[k] = b[k]

    if (b.cpfCnpj !== undefined) {
      patch.cpfCnpj = String(b.cpfCnpj).replace(/\D/g, '')
      patch.personType = personTypeOf(String(b.cpfCnpj))
    }

    await ctx.db.update(customers).set(patch).where(eq(customers.id, existing.id))
    return serialize({ ...existing, ...patch })
  },

  'remove-customer': async ({ ctx, auth, params }) => {
    const existing = await findOwned(ctx, auth, params.id!)
    // Remoção é lógica — dá para restaurar depois.
    await ctx.db.update(customers).set({ deleted: true }).where(eq(customers.id, existing.id))
    return { deleted: true, id: existing.id }
  },

  'restore-removed-customer': async ({ ctx, auth, params }) => {
    const existing = await findOwned(ctx, auth, params.id!)
    await ctx.db.update(customers).set({ deleted: false }).where(eq(customers.id, existing.id))
    return serialize({ ...existing, deleted: false })
  },
}

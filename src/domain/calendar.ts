/**
 * Aritmética de datas no formato de fio do Asaas ('YYYY-MM-DD').
 *
 * PURO: nenhuma função aqui lê o relógio. Quem precisa de "hoje" recebe como
 * argumento. Trabalhamos com a string diretamente em vez de `Date` porque o
 * `Date` do JS carrega fuso e hora, e a data de vencimento de um boleto não tem
 * nem uma coisa nem outra — misturar os dois é a origem clássica do bug de "a
 * cobrança venceu um dia antes para quem está em UTC-3".
 */

export type IsoDate = string // 'YYYY-MM-DD'

const DAY_MS = 86_400_000

/** 'YYYY-MM-DD' → epoch ms em UTC (meio-dia, para blindar contra DST). */
function toUtc(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!, 12, 0, 0)
}

function fromUtc(ms: number): IsoDate {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isValidIsoDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const ms = toUtc(date)
  return !Number.isNaN(ms) && fromUtc(ms) === date
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(date) + days * DAY_MS)
}

/** Diferença em dias inteiros: daysBetween('2026-01-10', '2026-01-01') === 9 */
export function daysBetween(later: IsoDate, earlier: IsoDate): number {
  return Math.round((toUtc(later) - toUtc(earlier)) / DAY_MS)
}

export const isBefore = (a: IsoDate, b: IsoDate): boolean => a < b // lexicográfico = cronológico
export const isAfter = (a: IsoDate, b: IsoDate): boolean => a > b
export const minDate = (a: IsoDate, b: IsoDate): IsoDate => (a <= b ? a : b)

/**
 * Soma meses preservando o dia. Quando o dia não existe no mês destino, cai para
 * o ÚLTIMO dia do mês: 31/jan + 1 mês = 28/fev (não 03/mar).
 *
 * É o comportamento que uma assinatura mensal precisa ter — senão a cobrança de
 * quem assinou dia 31 escorrega pelo calendário e acaba caindo em março.
 */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number)
  const target = new Date(Date.UTC(y!, m! - 1 + months, 1, 12))
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12),
  ).getUTCDate()
  target.setUTCDate(Math.min(d!, lastDay))
  return fromUtc(target.getTime())
}

/** 0 = domingo … 6 = sábado */
export function weekday(date: IsoDate): number {
  return new Date(toUtc(date)).getUTCDay()
}

// ── Dias úteis ───────────────────────────────────────────────

/**
 * Feriados nacionais fixos. Os móveis (Carnaval, Sexta-Feira Santa, Corpus
 * Christi) dependem da Páscoa — calculados abaixo.
 *
 * Feriados municipais e estaduais NÃO entram: o Asaas não publica quais
 * considera, e chutar produziria uma data de crédito errada com cara de certa.
 */
const FIXED_HOLIDAYS = new Set([
  '01-01', // Confraternização Universal
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '11-20', // Consciência Negra (nacional desde 2024)
  '12-25', // Natal
])

/** Domingo de Páscoa pelo algoritmo de Meeus/Jones/Butcher. */
function easterSunday(year: number): IsoDate {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const movableCache = new Map<number, Set<IsoDate>>()

function movableHolidays(year: number): Set<IsoDate> {
  const cached = movableCache.get(year)
  if (cached) return cached

  const easter = easterSunday(year)
  const set = new Set<IsoDate>([
    addDays(easter, -48), // Carnaval (segunda)
    addDays(easter, -47), // Carnaval (terça)
    addDays(easter, -2), // Sexta-Feira Santa
    addDays(easter, 60), // Corpus Christi
  ])
  movableCache.set(year, set)
  return set
}

export function isHoliday(date: IsoDate): boolean {
  if (FIXED_HOLIDAYS.has(date.slice(5))) return true
  return movableHolidays(Number(date.slice(0, 4))).has(date)
}

export function isBusinessDay(date: IsoDate): boolean {
  const wd = weekday(date)
  if (wd === 0 || wd === 6) return false
  return !isHoliday(date)
}

/** Se já for dia útil, devolve a própria data. */
export function nextBusinessDay(date: IsoDate): IsoDate {
  let d = date
  while (!isBusinessDay(d)) d = addDays(d, 1)
  return d
}

/** Avança N dias ÚTEIS. `addBusinessDays(d, 1)` é sempre o próximo dia útil depois de d. */
export function addBusinessDays(date: IsoDate, days: number): IsoDate {
  let d = date
  let remaining = days
  while (remaining > 0) {
    d = addDays(d, 1)
    if (isBusinessDay(d)) remaining--
  }
  return d
}

// ── Ciclos de assinatura ─────────────────────────────────────

export type Cycle =
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'BIMONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUALLY'
  | 'YEARLY'

/** A próxima data de vencimento de uma assinatura, dado o ciclo. */
export function advanceCycle(date: IsoDate, cycle: Cycle): IsoDate {
  switch (cycle) {
    case 'WEEKLY':
      return addDays(date, 7)
    case 'BIWEEKLY':
      return addDays(date, 14)
    case 'MONTHLY':
      return addMonths(date, 1)
    case 'BIMONTHLY':
      return addMonths(date, 2)
    case 'QUARTERLY':
      return addMonths(date, 3)
    case 'SEMIANNUALLY':
      return addMonths(date, 6)
    case 'YEARLY':
      return addMonths(date, 12)
  }
}

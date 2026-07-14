/**
 * O relógio. É a fronteira de disciplina do projeto inteiro.
 *
 * `Date.now()`, `new Date()` (sem argumento) e `Date` implícito são PROIBIDOS em
 * todo o resto do código. Um único vazamento e a viagem no tempo passa a gravar
 * a data real: o determinismo morre em silêncio e o bug reaparece como um teste
 * intermitente três meses depois. Há um teste (tests/unit/no-ambient-time) que
 * faz grep no fonte para garantir isso.
 *
 * Modos:
 *   REAL             segue o relógio do sistema. Default; paridade com dev.
 *   VIRTUAL_FLOWING  offset do relógio real — o tempo anda, mas você pode pular.
 *   VIRTUAL_FROZEN   só anda quando você manda. É o modo dos testes e do CI.
 */

/** Fuso de negócio do Asaas. Todo o cálculo de data acontece nele. */
export const BUSINESS_TZ = 'America/Sao_Paulo'

export type ClockMode = 'REAL' | 'VIRTUAL_FLOWING' | 'VIRTUAL_FROZEN'

export interface Clock {
  nowMs(): number
  now(): Date
  /** 'YYYY-MM-DD' no fuso de negócio. */
  today(): string
  /** 'YYYY-MM-DD HH:mm:ss' no fuso de negócio. */
  timestamp(): string
  readonly mode: ClockMode
}

const DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TZ,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** Date → 'YYYY-MM-DD' no fuso de negócio. */
export function toBusinessDate(d: Date): string {
  return DATE_FMT.format(d)
}

/** Date → 'YYYY-MM-DD HH:mm:ss' no fuso de negócio. */
export function toBusinessTimestamp(d: Date): string {
  // en-GB dá '24:00:00' à meia-noite em vez de '00:00:00'.
  const time = TIME_FMT.format(d).replace(/^24:/, '00:')
  return `${DATE_FMT.format(d)} ${time}`
}

export class RealClock implements Clock {
  readonly mode = 'REAL' as const
  nowMs(): number {
    return Date.now()
  }
  now(): Date {
    return new Date(this.nowMs())
  }
  today(): string {
    return toBusinessDate(this.now())
  }
  timestamp(): string {
    return toBusinessTimestamp(this.now())
  }
}

export class VirtualClock implements Clock {
  #mode: Exclude<ClockMode, 'REAL'>
  /** VIRTUAL_FROZEN: o instante. VIRTUAL_FLOWING: a base do offset. */
  #epochMs: number
  /** VIRTUAL_FLOWING: o instante real correspondente a #epochMs. */
  #anchorRealMs: number

  constructor(startMs: number, mode: Exclude<ClockMode, 'REAL'> = 'VIRTUAL_FROZEN') {
    this.#mode = mode
    this.#epochMs = startMs
    this.#anchorRealMs = Date.now()
  }

  get mode(): ClockMode {
    return this.#mode
  }

  nowMs(): number {
    if (this.#mode === 'VIRTUAL_FROZEN') return this.#epochMs
    return this.#epochMs + (Date.now() - this.#anchorRealMs)
  }

  now(): Date {
    return new Date(this.nowMs())
  }
  today(): string {
    return toBusinessDate(this.now())
  }
  timestamp(): string {
    return toBusinessTimestamp(this.now())
  }

  advance(ms: number): void {
    this.#epochMs = this.nowMs() + ms
    this.#anchorRealMs = Date.now()
  }

  setTo(epochMs: number): void {
    this.#epochMs = epochMs
    this.#anchorRealMs = Date.now()
  }

  freeze(): void {
    this.#epochMs = this.nowMs()
    this.#anchorRealMs = Date.now()
    this.#mode = 'VIRTUAL_FROZEN'
  }

  unfreeze(): void {
    this.#epochMs = this.nowMs()
    this.#anchorRealMs = Date.now()
    this.#mode = 'VIRTUAL_FLOWING'
  }

  /** Para persistir em clock_state e sobreviver ao restart do container. */
  snapshot() {
    return {
      mode: this.#mode,
      virtualEpochMs: this.#epochMs,
      anchorRealEpochMs: this.#anchorRealMs,
    }
  }
}

export const MINUTE_MS = 60_000
export const HOUR_MS = 3_600_000
export const DAY_MS = 86_400_000

/**
 * Constrói o relógio. Mora aqui, e não no bootstrap, porque semear um relógio
 * virtual exige ler o relógio REAL — e este é o único módulo autorizado a isso.
 *
 * `savedEpochMs` vem de `clock_state`: o relógio virtual é persistido, senão um
 * restart do container voltaria o relógio ao presente enquanto o banco
 * continuaria "no futuro".
 */
export function createClock(opts: {
  mode: ClockMode
  start?: string
  savedEpochMs?: number | null
}): Clock {
  if (opts.mode === 'REAL') return new RealClock()

  const startMs =
    opts.savedEpochMs ??
    (opts.start !== undefined && opts.start !== ''
      ? new Date(opts.start).getTime()
      : Date.now())

  if (Number.isNaN(startMs)) {
    throw new Error(`CLOCK_START inválido: "${opts.start}"`)
  }

  return new VirtualClock(startMs, opts.mode)
}

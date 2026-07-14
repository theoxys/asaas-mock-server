/**
 * Convenções do schema. Leia antes de adicionar qualquer coluna.
 *
 * DINHEIRO É INTEIRO EM CENTAVOS. Sempre. Sufixo `Cents` no nome.
 *   SQLite REAL é IEEE-754: um saldo corrente somado ao longo de milhares de
 *   lançamentos acumula erro. E as regras do Asaas são regras de RESTO EXATO
 *   ("a sobra de arredondamento vai na última parcela"), que só se expressam em
 *   aritmética inteira. R$ 1,99 → 199.
 *
 * PERCENTUAL DE SPLIT tem 4 casas decimais (92.3444%) → inteiro na escala 1e4,
 *   sufixo `E4`. 92.3444% → 923444.
 * TAXA PERCENTUAL em basis points (1 bp = 0,01%) → sufixo `Bp`. 2,99% → 299.
 *
 * DATAS SÃO TEXT, no formato de fio do Asaas:
 *   date     'YYYY-MM-DD'
 *   datetime 'YYYY-MM-DD HH:mm:ss'
 *   Lexicograficamente ordenável = cronologicamente ordenável. Sem surpresa de
 *   timezone. Fuso de negócio: America/Sao_Paulo.
 *
 * PROIBIDO: `.default(sql`CURRENT_TIMESTAMP`)` ou qualquer default de tempo.
 *   TODO timestamp é escrito pela aplicação a partir de `clock.now()`. Um único
 *   default de banco e o relógio virtual vaza — a viagem no tempo passa a gravar
 *   a data real e o determinismo morre em silêncio.
 */
import { integer, text } from 'drizzle-orm/sqlite-core'

/** Valor monetário em centavos. */
export const cents = (name: string) => integer(name, { mode: 'number' })

/** 'YYYY-MM-DD' */
export const date = (name: string) => text(name)

/** 'YYYY-MM-DD HH:mm:ss' */
export const datetime = (name: string) => text(name)

/** Epoch em ms. Só para ordenação estável e agendamento — nunca para exibir. */
export const epochMs = (name: string) => integer(name, { mode: 'number' })

export const bool = (name: string) => integer(name, { mode: 'boolean' })

/** Objeto serializado (discount, fine, interest, bankAccount…). */
export const json = <T>(name: string) => text(name, { mode: 'json' }).$type<T>()

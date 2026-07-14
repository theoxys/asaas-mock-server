/**
 * A busca e a ordenação das tabelas do painel.
 *
 * Testam a lógica PURA (`panel/src/components/table-logic.ts`), sem browser. É a única
 * parte da tela que pode estar errada de um jeito silencioso: um sort ruim não quebra
 * nada, não aparece no console, e não vira chamado. Vira "a tabela está meio bagunçada",
 * e a pessoa aprende a não confiar nela.
 */
import { describe, expect, it } from 'bun:test'
import {
  compareValues,
  filterRows,
  nextSort,
  sortRows,
  type Sortable,
} from '../../panel/src/components/table-logic.ts'

interface Row {
  id: string
  customer: string
  status: string
  value: number
  paidAt: string | null
}

const ROWS: Row[] = [
  { id: 'pay_1', customer: 'Ana Souza', status: 'PENDING', value: 90, paidAt: null },
  { id: 'pay_2', customer: 'Bruno Lima', status: 'RECEIVED', value: 1000, paidAt: '2026-07-02' },
  { id: 'pay_3', customer: 'Carla Dias', status: 'OVERDUE', value: 250, paidAt: null },
  { id: 'pay_4', customer: 'Ana Souza', status: 'RECEIVED', value: 90.5, paidAt: '2026-07-01' },
]

const COLUMNS: Sortable<Row>[] = [
  { key: 'id', value: (r) => r.id },
  { key: 'customer', value: (r) => r.customer },
  { key: 'status', value: (r) => r.status },
  { key: 'value', value: (r) => r.value },
  { key: 'paidAt', value: (r) => r.paidAt },
  { key: 'actions' }, // sem `value`: não ordena, não busca
]

describe('ordenação', () => {
  /**
   * O BUG QUE ESTE TESTE IMPEDE DE VOLTAR.
   *
   * Se a coluna ordenasse pelo TEXTO que aparece na tela ("R$ 1.000,00"), R$ 90 viria
   * DEPOIS de R$ 1.000 — porque "9" > "1". É por isso que `value(row)` devolve o número
   * cru e `render(row)` cuida do "R$".
   */
  it('valor ordena como NÚMERO, não como o texto "R$ 1.000,00"', () => {
    const asc = sortRows(ROWS, COLUMNS, { key: 'value', dir: 'asc' })
    expect(asc.map((r) => r.value)).toEqual([90, 90.5, 250, 1000])

    const desc = sortRows(ROWS, COLUMNS, { key: 'value', dir: 'desc' })
    expect(desc.map((r) => r.value)).toEqual([1000, 250, 90.5, 90])
  })

  it('texto ordena em pt-BR, com acento no lugar certo', () => {
    const rows = [{ n: 'Zeca' }, { n: 'Ávila' }, { n: 'ana' }, { n: 'Bruno' }]
    const cols: Sortable<{ n: string }>[] = [{ key: 'n', value: (r) => r.n }]

    // Um `a < b` cru colocaria 'Zeca' antes de 'ana' (maiúsculas vêm antes no ASCII) e
    // 'Ávila' depois de tudo. O Collator pt-BR resolve os dois.
    expect(sortRows(rows, cols, { key: 'n', dir: 'asc' }).map((r) => r.n)).toEqual([
      'ana',
      'Ávila',
      'Bruno',
      'Zeca',
    ])
  })

  /**
   * Vazio vai para o FIM em QUALQUER direção — não é "menor que tudo".
   *
   * Ordenar "Pago em" existe para ver o que foi pago. Se os nulos subissem ao topo no
   * ascendente, o clique produziria uma tela de traços: tecnicamente ordenada, inútil.
   */
  it('nulo vai para o fim nas duas direções, não para o topo', () => {
    const asc = sortRows(ROWS, COLUMNS, { key: 'paidAt', dir: 'asc' })
    expect(asc.map((r) => r.paidAt)).toEqual(['2026-07-01', '2026-07-02', null, null])

    const desc = sortRows(ROWS, COLUMNS, { key: 'paidAt', dir: 'desc' })
    expect(desc.map((r) => r.paidAt)).toEqual([null, null, '2026-07-02', '2026-07-01'])
  })

  it('não muta o array do pai — senão a lista pisca a cada render', () => {
    const original = [...ROWS]
    sortRows(ROWS, COLUMNS, { key: 'value', dir: 'desc' })
    expect(ROWS).toEqual(original)
  })

  it('coluna sem `value` não ordena — devolve a lista como veio', () => {
    expect(sortRows(ROWS, COLUMNS, { key: 'actions', dir: 'asc' })).toEqual(ROWS)
  })

  it('o terceiro clique tem saída: asc → desc → ordem do servidor', () => {
    const a = nextSort(null, 'value')
    expect(a).toEqual({ key: 'value', dir: 'asc' })

    const b = nextSort(a, 'value')
    expect(b).toEqual({ key: 'value', dir: 'desc' })

    // Sem isto, quem clicou não consegue mais desfazer.
    expect(nextSort(b, 'value')).toBeNull()

    // Trocar de coluna recomeça no ascendente.
    expect(nextSort(b, 'customer')).toEqual({ key: 'customer', dir: 'asc' })
  })
})

describe('busca', () => {
  it('procura em TODAS as colunas, não só no nome', () => {
    expect(filterRows(ROWS, COLUMNS, 'ana').map((r) => r.id)).toEqual(['pay_1', 'pay_4'])
    expect(filterRows(ROWS, COLUMNS, 'overdue').map((r) => r.id)).toEqual(['pay_3'])
    expect(filterRows(ROWS, COLUMNS, 'pay_2').map((r) => r.id)).toEqual(['pay_2'])
  })

  it('ignora caixa e espaço em volta', () => {
    expect(filterRows(ROWS, COLUMNS, '  BRUNO  ').map((r) => r.id)).toEqual(['pay_2'])
  })

  it('busca vazia devolve tudo, sem copiar', () => {
    expect(filterRows(ROWS, COLUMNS, '   ')).toBe(ROWS)
  })

  it('nada encontrado devolve lista vazia, não a lista inteira', () => {
    expect(filterRows(ROWS, COLUMNS, 'zzz')).toEqual([])
  })

  it('busca por número funciona: 1000 acha a cobrança de R$ 1.000', () => {
    expect(filterRows(ROWS, COLUMNS, '1000').map((r) => r.id)).toEqual(['pay_2'])
  })
})

describe('compareValues', () => {
  it('número antes de string quando os dois são números', () => {
    expect(compareValues(2, 10)).toBeLessThan(0)
    // Como texto, "10" < "2". É exatamente o erro que não podemos cometer.
    expect(compareValues('2', '10')).toBeLessThan(0) // o Collator é `numeric: true`
  })

  it('dois vazios empatam', () => {
    expect(compareValues(null, undefined)).toBe(0)
    expect(compareValues('', null)).toBe(0)
  })
})

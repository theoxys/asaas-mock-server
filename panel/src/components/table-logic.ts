/**
 * A lógica da tabela — buscar e ordenar. PURA, e separada do componente de propósito:
 * é a única parte que pode estar errada de um jeito silencioso, e a única que dá para
 * testar sem um browser.
 *
 * O bug que esta separação existe para impedir: ordenar "Valor" comparando a STRING
 * "R$ 1.000,00", onde R$ 90,00 vem depois de R$ 1.000,00 porque "9" > "1". Não parece
 * um bug — parece que "a tabela está meio bagunçada", e ninguém abre um chamado para
 * isso. Por isso a coluna declara `value(row)` (o dado cru) separado de `render(row)`
 * (como ele aparece): quem ordena olha o número.
 */
export interface SortSpec {
  key: string
  dir: 'asc' | 'desc'
}

export type Value = string | number | null | undefined

export interface Sortable<T> {
  key: string
  value?: (row: T) => Value
}

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

/**
 * Nulo vai para o FIM em qualquer direção. Uma coluna "Pago em" com metade das linhas
 * vazias não deve empurrar os traços para o topo quando você ordena por ela — o que
 * você quer ver é o que TEM data.
 */
export function compareValues(a: Value, b: Value): number {
  const an = a === null || a === undefined || a === ''
  const bn = b === null || b === undefined || b === ''
  if (an && bn) return 0
  if (an) return 1
  if (bn) return -1

  if (typeof a === 'number' && typeof b === 'number') return a - b
  return collator.compare(String(a), String(b))
}

/** Busca em TUDO que a linha mostra — não só no "nome". */
export function filterRows<T>(rows: T[], columns: Sortable<T>[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows

  const searchable = columns.filter((c) => c.value)
  return rows.filter((row) =>
    searchable.some((c) => String(c.value!(row) ?? '').toLowerCase().includes(q)),
  )
}

export function sortRows<T>(rows: T[], columns: Sortable<T>[], sort: SortSpec | null): T[] {
  if (!sort) return rows
  const col = columns.find((c) => c.key === sort.key)
  if (!col?.value) return rows

  // Cópia: `Array.sort` muta no lugar, e mutar o array do pai faz o Preact perder a
  // referência — a lista pisca a cada render.
  const out = [...rows]
  out.sort((a, b) => compareValues(col.value!(a), col.value!(b)))
  return sort.dir === 'desc' ? out.reverse() : out
}

/** asc → desc → sem ordenação (a do servidor). O terceiro clique tem que ter saída. */
export function nextSort(cur: SortSpec | null, key: string): SortSpec | null {
  if (cur?.key !== key) return { key, dir: 'asc' }
  if (cur.dir === 'asc') return { key, dir: 'desc' }
  return null
}

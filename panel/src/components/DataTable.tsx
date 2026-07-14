/**
 * A tabela com busca e ordenação. TODA listagem do painel passa por aqui.
 *
 * A tentação era resolver busca e sort dentro de cada página. Cinco páginas depois,
 * cada uma ordenaria de um jeito — uma comparando `String`, outra `localeCompare`, e a
 * de valores comparando "R$ 1.000,00" como TEXTO, onde R$ 90 vem depois de R$ 1.000.
 * Esse bug não parece um bug: parece que a tabela "está meio bagunçada".
 *
 * Por isso a coluna declara `value(row)` — o dado CRU (número ou string), separado do
 * `render(row)` que decide como ele aparece. Quem ordena e quem busca olham o valor;
 * quem desenha olha o render. Uma coluna sem `value` não ordena e não entra na busca,
 * e isso é explícito em vez de silencioso.
 */
import type { ComponentChildren } from 'preact'
import { useMemo, useState } from 'preact/hooks'
import * as I from '../icons.ts'
import { Icon } from './Icon.tsx'
import { filterRows, nextSort, sortRows, type SortSpec, type Value } from './table-logic.ts'
import { Empty } from './ui.tsx'
import './DataTable.css'

export interface Column<T> {
  key: string
  header: string
  /** Como a célula aparece. */
  render: (row: T) => ComponentChildren
  /**
   * O dado CRU, para ordenar e para buscar. Número ordena como número.
   * Sem isto, a coluna não ordena nem entra na busca — de propósito e à vista.
   */
  value?: (row: T) => Value
  align?: 'right'
}

export function DataTable<T>(props: {
  rows: T[]
  columns: Column<T>[]
  /** Texto do campo de busca. Sem ele, sem busca. */
  searchPlaceholder?: string
  /** Coluna e direção iniciais. */
  initialSort?: SortSpec
  empty?: ComponentChildren
  /** Uma coluna de ações no fim, fora da busca e da ordenação. */
  actions?: (row: T) => ComponentChildren
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortSpec | null>(props.initialSort ?? null)

  const sorted = useMemo(
    () => sortRows(filterRows(props.rows, props.columns, query), props.columns, sort),
    [props.rows, props.columns, query, sort],
  )

  const toggle = (key: string) => setSort((cur) => nextSort(cur, key))

  return (
    <div class="dt">
      {props.searchPlaceholder && (
        <div class="dt-bar">
          <div class="dt-search">
            <Icon icon={I.SEARCH} size={16} />
            <input
              type="search"
              placeholder={props.searchPlaceholder}
              value={query}
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            />
          </div>
          <span class="dt-count">
            {query
              ? `${sorted.length} de ${props.rows.length}`
              : `${props.rows.length} ${props.rows.length === 1 ? 'registro' : 'registros'}`}
          </span>
        </div>
      )}

      <div class="scroll">
        <table>
          <thead>
            <tr>
              {props.columns.map((c) => {
                const active = sort?.key === c.key
                return (
                  <th key={c.key} class={c.align === 'right' ? 'right' : undefined}>
                    {c.value ? (
                      <button
                        class={`dt-sort ${active ? 'active' : ''}`}
                        onClick={() => toggle(c.key)}
                        title="Ordenar"
                      >
                        {c.header}
                        <Icon
                          icon={active && sort.dir === 'desc' ? I.SORT_DESC : I.SORT_ASC}
                          size={13}
                          class="dt-arrow"
                        />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
              {props.actions && <th />}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i}>
                {props.columns.map((c) => (
                  <td key={c.key} class={c.align === 'right' ? 'right' : undefined}>
                    {c.render(row)}
                  </td>
                ))}
                {props.actions && <td>{props.actions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <Empty>
          {query ? `nada encontrado para "${query}"` : (props.empty ?? 'nenhum registro')}
        </Empty>
      )}
    </div>
  )
}

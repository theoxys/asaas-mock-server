/**
 * Os ícones. HugeIcons (licença livre), no estilo `stroke-rounded`.
 *
 * Antes eram glifos Unicode (`⌂`, `⚡`, `⑃`), e a troca não é cosmética: metade deles
 * tinha apresentação de EMOJI por padrão, então o browser pintava um raio amarelo e uma
 * casinha colorida no meio de uma navegação monocromática — e a mesma string virava um
 * desenho diferente em cada sistema operacional. Um glifo de fonte não é um ícone: é o
 * que a fonte do usuário decidir que ele é.
 *
 * Importamos os DADOS (`@hugeicons/core-free-icons`), não o componente React da lib. São
 * 13.624 ícones tree-shakeable: o bundle leva só os que a tela usa, e o projeto não ganha
 * uma dependência de React só para desenhar uma casinha.
 */
import { h, type JSX } from 'preact'

/** O formato do pacote: uma lista de [tag, atributos]. */
export type IconData = ReadonlyArray<readonly [string, Record<string, unknown>]>

export function Icon({
  icon,
  size = 20,
  strokeWidth = 1.6,
  ...rest
}: {
  icon: IconData
  size?: number
  strokeWidth?: number
} & JSX.SVGAttributes<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...rest}>
      {icon.map(([tag, attrs], i) =>
        // `h(tag, …)` e não um `<path>` fixo: o pacote também emite `circle`, `rect` e
        // `line`, e um path fixo engoliria esses em silêncio — o ícone renderizaria pela
        // metade, sem erro nenhum.
        h(tag, {
          ...attrs,
          // Sobrescreve o `stroke` que vem no dado (um preto fixo). Sem isto o ícone
          // ignora o tema e some no fundo escuro.
          stroke: 'currentColor',
          strokeWidth,
          key: i,
        }),
      )}
    </svg>
  )
}

/**
 * O tema. Claro por padrão — é o do Asaas, e é a aparência que esta tela existe para ter.
 *
 * NÃO seguimos `prefers-color-scheme`: numa máquina configurada no escuro (a maioria das
 * de dev), o painel nunca apareceria como foi desenhado. O escuro fica atrás de uma
 * escolha explícita, guardada no localStorage.
 *
 * O `data-theme` é aplicado no <html> ANTES do primeiro paint (ver o script inline no
 * index.html), senão quem escolheu escuro vê um flash branco a cada reload.
 */
import { useEffect, useState } from 'preact/hooks'

export type Theme = 'light' | 'dark'
const KEY = 'asaas-mock:theme'

export function readTheme(): Theme {
  return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(KEY, theme)
  }, [theme])

  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))] as const
}

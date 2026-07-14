/**
 * O painel compila para UM ARQUIVO só: `src/admin/ui.html`.
 *
 * `vite-plugin-singlefile` inlina JS e CSS no HTML. Isso preserva a propriedade que
 * o painel tinha quando era um HTML escrito à mão, e que vale mais do que parece:
 * o RUNTIME continua sendo só Bun servindo um arquivo. Sem servidor de assets, sem
 * rota de estáticos, sem cache-busting, sem uma segunda coisa que pode 404 dentro
 * do container. O build acontece num stage à parte do Dockerfile e some.
 */
import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [preact(), viteSingleFile()],
  build: {
    // Constrói para `panel/dist` e o script `panel:build` copia o HTML para
    // `src/admin/ui.html`. Apontar o outDir direto para `src/admin` faria o Vite
    // querer limpar um diretório que é CÓDIGO DO SERVIDOR.
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
  server: {
    // `bun run panel:dev` levanta o Vite com HMR e manda /v3 e /_admin para o
    // simulador de verdade — é o que torna trabalhar na tela suportável.
    port: 45446,
    proxy: {
      '/v3': 'http://localhost:45445',
      '/_admin': 'http://localhost:45445',
    },
  },
})

/**
 * Baixa a spec do Asaas e regrava `spec/openapi.json` + `spec/openapi.lock.json`.
 *
 * NÃO faz parte do build. O build é hermético e offline: lê só o arquivo
 * vendorizado. Rode isto à mão quando quiser atualizar a spec, e revise o diff.
 *
 *   bun run spec:fetch
 */
import { buildLock, fetchSpec, LOCK_PATH, readLock, SPEC_PATH, sha256 } from './spec.ts'

const previous = await readLock()

console.log('Baixando a spec do Asaas…')
const raw = await fetchSpec()
const hash = await sha256(raw)

if (previous && previous.sha256 === hash) {
  console.log(`Sem mudanças. sha256=${hash.slice(0, 12)}…`)
  process.exit(0)
}

// Reserializa indentado: um blob de 1 MB em uma linha só torna o diff do git inútil.
const pretty = `${JSON.stringify(JSON.parse(raw), null, 2)}\n`
await Bun.write(SPEC_PATH, pretty)

const lock = await buildLock(pretty, new Date().toISOString())
await Bun.write(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`)

console.log(`Spec atualizada.`)
console.log(`  paths      ${lock.pathCount}`)
console.log(`  operações  ${lock.operationCount}`)
console.log(`  schemas    ${lock.schemaCount}`)
console.log(`  sha256     ${lock.sha256.slice(0, 12)}…`)
if (previous) {
  console.log(`\nA spec MUDOU. Rode "bun run spec:diff" para ver o quê, e "bun run codegen".`)
}

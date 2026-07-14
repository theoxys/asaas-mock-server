/**
 * Detector de drift: baixa a spec do Asaas e compara estruturalmente com o lock
 * vendorizado. Não escreve nada.
 *
 * Roda num job agendado (semanal), separado do build. Sai com código 1 se houver
 * drift, para que o CI abra uma issue.
 *
 *   bun run spec:diff
 */
import { buildLock, readLock } from './spec.ts'
import { fetchSpec } from './spec.ts'

const lock = await readLock()
if (!lock) {
  console.error('spec/openapi.lock.json não existe. Rode "bun run spec:fetch" primeiro.')
  process.exit(1)
}

const raw = await fetchSpec()
const fresh = await buildLock(`${JSON.stringify(JSON.parse(raw), null, 2)}\n`, 'n/a')

if (fresh.sha256 === lock.sha256) {
  console.log('Sem drift. A spec vendorizada está em dia com o Asaas.')
  process.exit(0)
}

const diffKeys = (before: Record<string, string>, after: Record<string, string>) => ({
  added: Object.keys(after).filter((k) => !(k in before)),
  removed: Object.keys(before).filter((k) => !(k in after)),
  changed: Object.keys(after).filter((k) => k in before && before[k] !== after[k]),
})

const ops = diffKeys(lock.operations, fresh.operations)
const schemas = diffKeys(lock.schemas, fresh.schemas)

const report = (label: string, d: ReturnType<typeof diffKeys>) => {
  if (!d.added.length && !d.removed.length && !d.changed.length) return
  console.log(`\n${label}`)
  for (const k of d.added) console.log(`  + ${k}`)
  for (const k of d.removed) console.log(`  - ${k}`)
  for (const k of d.changed) console.log(`  ~ ${k}`)
}

console.log('DRIFT DETECTADO — a spec do Asaas mudou.')
console.log(`  operações  ${lock.operationCount} → ${fresh.operationCount}`)
console.log(`  schemas    ${lock.schemaCount} → ${fresh.schemaCount}`)
report('Operações', ops)
report('Schemas', schemas)
console.log(
  `\nPara adotar: "bun run spec:fetch" && "bun run codegen" && "bun test".` +
    `\nAtenção especial aos overlays em spec/overlays/ — se o Asaas corrigiu o que o` +
    `\noverlay remendava, o codegen vai falhar apontando o path que não resolve mais.`,
)
process.exit(1)

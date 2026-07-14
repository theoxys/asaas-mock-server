/**
 * Cobertura de operações — COMPUTADA do manifesto ∩ handler map.
 *
 *   bun run coverage:ops
 *
 * Nunca mantenha esse número à mão no progress.md. Um agente sabe computá-lo.
 */
import { getOperation, OPERATION_COUNT, OPERATION_IDS } from '../src/generated/operations.ts'
import { HANDLERS } from '../src/modules/index.ts'

const implemented: string[] = []
const stubbed: string[] = []
const variants: string[] = []

for (const id of OPERATION_IDS) {
  const op = getOperation(id)
  if (op.variantOf) variants.push(id)
  else if (HANDLERS[id]) implemented.push(id)
  else stubbed.push(id)
}

const routable = OPERATION_COUNT - variants.length
const pct = routable === 0 ? 0 : Math.round((implemented.length / routable) * 100)

console.log(`implemented: ${implemented.length}/${routable} (${pct}%)`)
console.log(`stubbed:     ${stubbed.length}  (respondem 501)`)
console.log(`variants:    ${variants.length}  (dividem rota com a operação canônica)`)
console.log(`total spec:  ${OPERATION_COUNT}`)

if (process.argv.includes('--by-tag')) {
  const byTag = new Map<string, { done: number; total: number }>()
  for (const id of OPERATION_IDS) {
    const op = getOperation(id)
    if (op.variantOf) continue
    const e = byTag.get(op.tag) ?? { done: 0, total: 0 }
    e.total++
    if (HANDLERS[id]) e.done++
    byTag.set(op.tag, e)
  }
  console.log('\npor tag:')
  for (const [tag, { done, total }] of [...byTag].sort((a, b) => b[1].total - a[1].total)) {
    const bar = '█'.repeat(Math.round((done / total) * 10)).padEnd(10, '·')
    console.log(`  ${bar} ${String(done).padStart(2)}/${String(total).padEnd(2)}  ${tag}`)
  }
}

if (process.argv.includes('--list-missing')) {
  console.log('\nnão implementadas:')
  for (const id of stubbed) console.log(`  ${id}`)
}

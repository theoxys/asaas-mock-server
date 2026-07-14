/**
 * O guarda do determinismo.
 *
 * Um único `Date.now()` ou `Math.random()` fora de core/clock.ts e core/rng.ts
 * destrói o relógio virtual em silêncio: a viagem no tempo passa a gravar a data
 * real, e o bug reaparece como um teste intermitente daqui a três meses.
 *
 * Este teste é feio de propósito — ele faz grep no fonte. Um lint rule seria mais
 * elegante, mas o lint se desliga com um comentário e este teste, não.
 */
import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(import.meta.dir, '..', '..', 'src')

/** Os únicos lugares autorizados a tocar tempo e aleatoriedade ambientes. */
const ALLOWED = new Set(['core/clock.ts', 'core/rng.ts'])

/** Padrões proibidos e por quê. */
const BANNED: { pattern: RegExp; what: string }[] = [
  { pattern: /\bDate\.now\s*\(/, what: 'Date.now()' },
  { pattern: /\bnew Date\s*\(\s*\)/, what: 'new Date() sem argumento' },
  { pattern: /\bMath\.random\s*\(/, what: 'Math.random()' },
  { pattern: /\bcrypto\.randomUUID\s*\(/, what: 'crypto.randomUUID()' },
  { pattern: /CURRENT_TIMESTAMP/i, what: 'CURRENT_TIMESTAMP (default de tempo no banco)' },
]

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (entry.endsWith('.ts')) yield full
  }
}

describe('determinismo: nada de tempo/aleatoriedade ambiente fora do core', () => {
  it('src/ não usa Date.now(), new Date(), Math.random() nem crypto.randomUUID()', () => {
    const violations: string[] = []

    for (const file of walk(SRC)) {
      const rel = relative(SRC, file)
      if (ALLOWED.has(rel)) continue
      // Código gerado não tem lógica de runtime — só schemas.
      if (rel.startsWith('generated/')) continue

      const source = readFileSync(file, 'utf8')
      source.split('\n').forEach((line, i) => {
        if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return
        for (const { pattern, what } of BANNED) {
          if (pattern.test(line)) {
            violations.push(`${rel}:${i + 1} usa ${what} — use ctx.clock / ctx.rng`)
          }
        }
      })
    }

    expect(violations).toEqual([])
  })
})

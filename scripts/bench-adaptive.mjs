// TEMPORARY (PR-only): A/B benchmark for the pool's adaptive worker scaling.
// Generates small fixtures inside the repo (so `vitest` resolves from the
// workspace root), then interleaves reps of VITEST_POOL_ADAPTIVE=1 (default)
// vs VITEST_POOL_ADAPTIVE=0 (previous behavior) within every cell.
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
const CLI = join(REPO, 'packages/vitest/dist/cli.js')
const REPS = Number(process.env.BENCH_REPS || 5)

const FIXTURE_ROOT = join(REPO, '.bench-adaptive')

function generateFixture(name, fileCount) {
  const root = join(FIXTURE_ROOT, name)
  rmSync(root, { recursive: true, force: true })
  mkdirSync(join(root, 'test'), { recursive: true })
  mkdirSync(join(root, 'src'), { recursive: true })
  for (let i = 0; i < 5; i++) {
    writeFileSync(join(root, `src/m${i}.ts`), `
export function m${i}(x: number): number {
  return x * ${i + 2}
}
`)
  }
  for (let t = 0; t < fileCount; t++) {
    writeFileSync(join(root, `test/t${t}.test.ts`), `
import { expect, test } from 'vitest'
import { m${t % 5} } from '../src/m${t % 5}'

test('t${t} computes', () => {
  expect(m${t % 5}(${t})).toBe(${t * ((t % 5) + 2)})
})
test('t${t} strings', () => {
  expect('t${t}'.repeat(2)).toContain('t${t}')
})
`)
  }
  writeFileSync(join(root, 'vitest.config.ts'), `
import { defineConfig } from 'vitest/config'

export default defineConfig({
  cacheDir: 'node_modules/.vite-bench',
  test: {
    watch: false,
    environment: 'node',
    pool: process.env.BENCH_POOL as 'forks',
    isolate: process.env.BENCH_ISOLATE !== '0',
    reporters: [['default', { summary: false }]],
  },
})
`)
  return root
}

function runOnce(root, pool, isolate, adaptive) {
  const env = {
    ...process.env,
    NO_COLOR: '1',
    CI: 'true',
    BENCH_POOL: pool,
    BENCH_ISOLATE: isolate ? '1' : '0',
    VITEST_POOL_ADAPTIVE: adaptive ? '1' : '0',
  }
  const start = performance.now()
  const result = spawnSync(process.execPath, [CLI, 'run', '--root', root], {
    env,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  })
  const wall = performance.now() - start
  if (result.status !== 0) {
    console.error(`FAILED pool=${pool} isolate=${isolate} adaptive=${adaptive}`)
    console.error(result.stdout?.slice(-2000))
    console.error(result.stderr?.slice(-2000))
    process.exit(1)
  }
  return wall
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[sorted.length >> 1]
}

const small = generateFixture('small', 40)
const large = generateFixture('large', 160)

const CELLS = [
  { label: 'forks isolate:false 40 files', root: small, pool: 'forks', isolate: false },
  { label: 'forks isolate:true 40 files', root: small, pool: 'forks', isolate: true },
  { label: 'forks isolate:false 160 files', root: large, pool: 'forks', isolate: false },
  { label: 'threads isolate:false 40 files', root: small, pool: 'threads', isolate: false },
]

const rows = []
for (const cell of CELLS) {
  // warm up the transform cache once so the reps measure scheduling, not
  // first-transform noise
  runOnce(cell.root, cell.pool, cell.isolate, true)
  const adaptive = []
  const fixed = []
  for (let rep = 0; rep < REPS; rep++) {
    adaptive.push(runOnce(cell.root, cell.pool, cell.isolate, true))
    fixed.push(runOnce(cell.root, cell.pool, cell.isolate, false))
    console.error(`${cell.label} rep${rep}: adaptive=${adaptive.at(-1) | 0}ms fixed=${fixed.at(-1) | 0}ms`)
  }
  const adaptiveMed = median(adaptive)
  const fixedMed = median(fixed)
  const delta = ((adaptiveMed - fixedMed) / fixedMed * 100).toFixed(1)
  rows.push(`| ${cell.label} | ${fixedMed | 0}ms | ${adaptiveMed | 0}ms | ${delta}% |`)
}

console.log('\n### Adaptive pool scaling A/B (median of %d, lower is better)\n', REPS)
console.log('| cell | fixed (old) | adaptive | Δ |')
console.log('|---|---:|---:|---:|')
for (const row of rows) {
  console.log(row)
}

rmSync(FIXTURE_ROOT, { recursive: true, force: true })

import type { createBenchmarkJsonReport } from 'vitest/src/node/reporters/benchmark/json-formatter.js'
import fs from 'node:fs'
import * as pathe from 'pathe'
import { assert, expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

it('sequential', async () => {
  const root = pathe.join(import.meta.dirname, '../fixtures/benchmarking/sequential')
  await runVitest({ root }, [], { mode: 'benchmark' })
  const testLog = await fs.promises.readFile(pathe.join(root, 'test.log'), 'utf-8')
  expect(testLog).toMatchSnapshot()
})

it('summary', async () => {
  const root = pathe.join(import.meta.dirname, '../fixtures/benchmarking/reporter')
  const result = await runVitest({ root }, ['summary.bench.ts'], { mode: 'benchmark' })
  expect(result.stderr).toBe('')
  expect(result.stdout).not.toContain('NaNx')
  expect(result.stdout.split('BENCH  Summary')[1].replaceAll(/[0-9.]+x/g, '(?)')).toMatchSnapshot()
})

it('non-tty', async () => {
  const root = pathe.join(import.meta.dirname, '../fixtures/benchmarking/basic')
  const result = await runVitest({ root }, ['base.bench.ts'], { mode: 'benchmark' })
  const lines = result.stdout.split('\n').slice(4).slice(0, 11)
  const expected = `\
 ✓ base.bench.ts > sort
     name
   · normal
   · reverse

 ✓ base.bench.ts > timeout
     name
   · timeout100
   · timeout75
   · timeout50
   · timeout25
`

  for (const [index, line] of expected.trim().split('\n').entries()) {
    expect(lines[index]).toMatch(line)
  }
})

it.for([true, false])('includeSamples %s', async (includeSamples) => {
  const result = await runVitest(
    {
      root: pathe.join(import.meta.dirname, '../fixtures/benchmarking/reporter'),
      benchmark: { includeSamples },
    },
    ['summary.bench.ts'],
    { mode: 'benchmark' },
  )
  assert(result.ctx)
  const allSamples = [...result.ctx.state.idMap.values()]
    .filter(t => t.meta.benchmark)
    .map(t => t.result?.benchmark?.samples)
  if (includeSamples) {
    expect(allSamples[0]).not.toEqual([])
  }
  else {
    expect(allSamples[0]).toEqual([])
  }
})

it('compare', async () => {
  await fs.promises.rm('./fixtures/benchmarking/compare/bench.json', { force: true })

  // --outputJson
  {
    const result = await runVitest({
      root: './fixtures/benchmarking/compare',
      outputJson: './bench.json',
      reporters: ['default'],
    }, [], { mode: 'benchmark' })
    expect(result.exitCode).toBe(0)
    expect(fs.existsSync('./fixtures/benchmarking/compare/bench.json')).toBe(true)
  }

  // --compare
  {
    const result = await runVitest({
      root: './fixtures/benchmarking/compare',
      compare: './bench.json',
      reporters: ['default'],
    }, [], { mode: 'benchmark' })
    expect(result.exitCode).toBe(0)
    const lines = result.stdout.split('\n').slice(4).slice(0, 6)
    const expected = `
✓ basic.bench.ts > suite
    name
  · sleep10
             (baseline)
  · sleep100
             (baseline)
  `

    for (const [index, line] of expected.trim().split('\n').entries()) {
      expect(lines[index]).toMatch(line.trim())
    }
  }
})

it('basic', { timeout: 60_000 }, async () => {
  const root = pathe.join(import.meta.dirname, '../fixtures/benchmarking/basic')
  const benchFile = pathe.join(root, 'bench.json')
  fs.rmSync(benchFile, { force: true })

  const result = await runVitest({
    root,
    allowOnly: true,
    outputJson: 'bench.json',

    // Verify that type testing cannot be used with benchmark
    typecheck: { enabled: true },
  }, [], { mode: 'benchmark' })
  expect(result.stderr).toBe('')
  expect(result.exitCode).toBe(0)

  const benchResult = await fs.promises.readFile(benchFile, 'utf-8')
  const resultJson: ReturnType<typeof createBenchmarkJsonReport> = JSON.parse(benchResult)
  const names = resultJson.files.map(f => f.groups.map(g => [g.fullName, g.benchmarks.map(b => b.name)]))
  expect(names).toMatchInlineSnapshot(`
    [
      [
        [
          "base.bench.ts > sort",
          [
            "normal",
            "reverse",
          ],
        ],
        [
          "base.bench.ts > timeout",
          [
            "timeout100",
            "timeout75",
            "timeout50",
            "timeout25",
          ],
        ],
      ],
      [],
      [
        [
          "only.bench.ts",
          [
            "visited",
            "visited2",
          ],
        ],
        [
          "only.bench.ts > a0",
          [
            "0",
          ],
        ],
        [
          "only.bench.ts > a1 > b1 > c1",
          [
            "1",
          ],
        ],
        [
          "only.bench.ts > a2",
          [
            "2",
          ],
        ],
        [
          "only.bench.ts > a3 > b3",
          [
            "3",
          ],
        ],
        [
          "only.bench.ts > a4 > b4",
          [
            "4",
          ],
        ],
      ],
    ]
  `)
})

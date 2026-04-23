import type { TestBenchmark, TestBenchmarkTask } from 'vitest'
import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

// keep runs tiny — this suite asserts wiring, not measurement accuracy
const fastBenchOptions = {
  time: 0,
  iterations: 2,
  warmupTime: 0,
  warmupIterations: 0,
}

test('bench.compare records benchmark results for each registration', async () => {
  const benchmarks: TestBenchmark[] = []

  const { stderr } = await runInlineTests(
    {
      'basic.bench.ts': /* ts */`
        import { test, inject } from 'vitest'

        test('compare loops', async ({ bench }) => {
          await bench.compare(
            bench('for', () => { let x = 0; for (let i = 0; i < 10; i++) x += i }),
            bench('while', () => { let x = 0, i = 0; while (i < 10) { x += i; i++ } }),
            inject('options'),
          )
        })
`,
    },
    {
      benchmark: { enabled: true },
      reporters: [
        {
          onTestCaseBenchmark(_testCase, benchmark) {
            benchmarks.push(benchmark)
          },
        },
      ],
      provide: {
        options: fastBenchOptions,
      },
    },
  )

  expect(stderr).toBe('')
  expect(benchmarks).toHaveLength(1)
  const [{ tasks }] = benchmarks
  expect(tasks.map(t => t.name).sort()).toEqual(['for', 'while'])
  expect(tasks.every(t => typeof t.latency.mean === 'number')).toBe(true)
  expect(tasks.map(t => t.rank).sort()).toEqual([1, 2])
})

test('bench accepts options as second argument and rejects them as third', async () => {
  const { stderr, results } = await runInlineTests(
    {
      'sig.bench.ts': /* ts */`
        import { test, expect } from 'vitest'

        test('bench signatures', ({ bench }) => {
          const fn = () => 1
          const opts = { async: false }

          // options as the 2nd argument (preferred form, matches test())
          const withOpts = bench('with-opts', opts, fn)
          expect(withOpts.name).toBe('with-opts')
          expect(withOpts.fn).toBe(fn)
          expect(withOpts.fnOpts).toBe(opts)

          // simplest form — no options
          const noOpts = bench('no-opts', fn)
          expect(noOpts.fn).toBe(fn)
          expect(noOpts.fnOpts).toBeUndefined()

          // legacy (fn, options) form must throw
          expect(() => bench('legacy', fn, opts)).toThrow(/third argument/)
        })
`,
    },
    { benchmark: { enabled: true } },
  )

  expect(stderr).toBe('')
  const testCases = [...(results[0]?.children.allTests() ?? [])]
  expect(testCases).toHaveLength(1)
  expect(testCases[0].result()?.state).toBe('passed')
})

test('bench exposes all withBaseline / perProject compositions and prints a table', async () => {
  const tasks: TestBenchmarkTask[] = []

  const { stderr, stdout } = await runInlineTests(
    {
      'compositions.bench.ts': /* ts */`
        import { test, inject } from 'vitest'

        test('all compositions', async ({ bench }) => {
          await bench.compare(
            bench('plain', () => {}),
            bench.withBaseline('baseline', () => {}),
            bench.perProject('perProject', () => {}),
            bench.withBaseline.perProject('baseline+perProject', () => {}),
            bench.perProject.withBaseline('perProject+baseline', () => {}),
            inject('options'),
          )
        })
`,
    },
    {
      benchmark: { enabled: true },
      reporters: [
        'default',
        {
          onTestCaseBenchmark(_testCase, benchmark) {
            tasks.push(...benchmark.tasks)
          },
        },
      ],
      provide: { options: fastBenchOptions },
    },
  )

  expect(stderr).toBe('')

  // every factory shape produces a registration with the right flags
  const byName = Object.fromEntries(
    tasks.map(t => [t.name, { baseline: !!t.baseline, perProject: !!t.perProject }]),
  )
  expect(byName).toEqual({
    'plain': { baseline: false, perProject: false },
    'baseline': { baseline: true, perProject: false },
    'perProject': { baseline: false, perProject: true },
    'baseline+perProject': { baseline: true, perProject: true },
    'perProject+baseline': { baseline: true, perProject: true },
  })

  // snapshot the rendered inline benchmark table. Rows are sorted by name so
  // measurement-driven rank ordering doesn't reshuffle them, and the
  // rank-dependent fastest/slowest suffix is stripped.
  const lines = stdout.split('\n')
  const headerIdx = lines.findIndex(l => /^\s*name\s+hz\s+min/.test(l))
  expect(headerIdx).toBeGreaterThanOrEqual(0)
  const [header, ...rows] = lines.slice(headerIdx, headerIdx + 6)
  const normalized = formatBenchTable([
    header,
    ...rows.map(r => r.replace(/\s+(?:fastest|slowest)\s*$/, '')).sort(),
  ])

  expect(normalized).toMatchInlineSnapshot(`
    "     name                 hz  min  max  mean  p75  p99  p995  p999   rme  samples
         baseline             d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+
         baseline+perProject  d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+
         perProject           d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+
         perProject+baseline  d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+
         plain                d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+"
  `)

  // the three perProject compositions are also emitted in the cross-project section
  expect(stdout).toContain('Cross-Project Benchmark Comparison')
  for (const name of ['perProject', 'baseline+perProject', 'perProject+baseline']) {
    expect(stdout).toContain(`> ${name}`)
  }
})

// Rebuilds a benchmark table with every numeric cell replaced by `d+`, padded
// with spaces so each column keeps its natural alignment (first column
// left-aligned, numeric columns right-aligned — same rules the reporter uses).
// Column widths come from the normalized content so measurement noise at
// `time: 0` can't shift them between runs. The negative lookbehind on `\d+`
// keeps column labels like `p75` / `p995` intact.
function formatBenchTable(tableLines: string[]): string {
  const indent = tableLines[0].match(/^\s*/)![0]
  const rows = tableLines.map(line =>
    line.slice(indent.length).trimEnd().split(/\s{2,}/).map(cell =>
      cell.trim().replace(/(?<![a-z0-9])[\d,.]+/gi, 'd+'),
    ),
  )
  const widths = rows[0].map((_, i) =>
    Math.max(...rows.map(r => (r[i] ?? '').length)),
  )
  return rows
    .map(row => indent + row.map((cell, i) =>
      i === 0 ? cell.padEnd(widths[i]) : cell.padStart(widths[i]),
    ).join('  '))
    .join('\n')
}

// Runs a single `bench(...).run()` through runInlineTests and pulls apart
// the reporter output so each test below can snapshot its table in isolation.
async function runComposition(benchCall: string): Promise<{
  tasks: TestBenchmarkTask[]
  inlineTable: string
  crossProjectSection: string | null
}> {
  const tasks: TestBenchmarkTask[] = []
  const { stderr, stdout } = await runInlineTests(
    {
      'composition.bench.ts': /* ts */`
        import { test, inject } from 'vitest'

        test('composition', async ({ bench }) => {
          await ${benchCall}.run(inject('options'))
        })
`,
    },
    {
      benchmark: { enabled: true },
      reporters: [
        'default',
        {
          onTestCaseBenchmark(_testCase, benchmark) {
            tasks.push(...benchmark.tasks)
          },
        },
      ],
      provide: { options: fastBenchOptions },
    },
  )

  expect(stderr).toBe('')

  const lines = stdout.split('\n')
  const headerIdx = lines.findIndex(l => /^\s*name\s+hz\s+min/.test(l))
  expect(headerIdx).toBeGreaterThanOrEqual(0)
  const inlineTable = formatBenchTable([
    lines[headerIdx],
    lines[headerIdx + 1].replace(/\s+(?:fastest|slowest)\s*$/, ''),
  ])

  // the cross-project section is a divider + a series of titled sub-tables
  // (each 2 lines: `project …` header + data row). Reformat each sub-table
  // through formatBenchTable while leaving divider and title lines alone.
  let crossProjectSection: string | null = null
  const xpIdx = lines.findIndex(l => /Cross-Project Benchmark Comparison/.test(l))
  if (xpIdx >= 0) {
    const summaryIdx = lines.findIndex((l, i) => i > xpIdx && /^\s*Test Files\s/.test(l))
    const xpLines = lines.slice(xpIdx, summaryIdx < 0 ? undefined : summaryIdx)
    const out: string[] = []
    for (let i = 0; i < xpLines.length; i++) {
      const line = xpLines[i]
      if (/^\s*project\s+hz\s+min/.test(line) && i + 1 < xpLines.length) {
        out.push(formatBenchTable([
          line,
          xpLines[i + 1].replace(/\s+(?:fastest|slowest)\s*$/, ''),
        ]))
        i++
      }
      else {
        out.push(line)
      }
    }
    crossProjectSection = out.join('\n').trim()
  }

  return { tasks, inlineTable, crossProjectSection }
}

function assertFlags(task: TestBenchmarkTask, name: string, flags: { baseline?: true; perProject?: true }) {
  expect(task.name).toBe(name)
  expect(task.baseline).toBe(flags.baseline)
  expect(task.perProject).toBe(flags.perProject)
}

test('plain `bench()` records a task with no flags', async () => {
  const { tasks, inlineTable, crossProjectSection } = await runComposition(
    `bench('plain', () => {})`,
  )
  expect(tasks).toHaveLength(1)
  assertFlags(tasks[0], 'plain', {})
  expect(crossProjectSection).toBeNull()
  expect(inlineTable).toMatchInlineSnapshot(`
    "     name   hz  min  max  mean  p75  p99  p995  p999   rme  samples
         plain  d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+"
  `)
})

test('`bench.withBaseline()` records a baseline task, no cross-project table', async () => {
  const { tasks, inlineTable, crossProjectSection } = await runComposition(
    `bench.withBaseline('baseline', () => {})`,
  )
  expect(tasks).toHaveLength(1)
  assertFlags(tasks[0], 'baseline', { baseline: true })
  expect(crossProjectSection).toBeNull()
  expect(inlineTable).toMatchInlineSnapshot(`
    "     name      hz  min  max  mean  p75  p99  p995  p999   rme  samples
         baseline  d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+"
  `)
})

test('`bench.perProject()` records a perProject task in BOTH inline and cross-project tables', async () => {
  const { tasks, inlineTable, crossProjectSection } = await runComposition(
    `bench.perProject('perProject', () => {})`,
  )
  expect(tasks).toHaveLength(1)
  assertFlags(tasks[0], 'perProject', { perProject: true })
  expect(inlineTable).toMatchInlineSnapshot(`
    "     name        hz  min  max  mean  p75  p99  p995  p999   rme  samples
         perProject  d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+"
  `)
  expect(crossProjectSection).toMatchInlineSnapshot(`
    "Cross-Project Benchmark Comparison 

      composition.bench.ts > composition > perProject
       project  hz  min  max  mean  p75  p99  p995  p999   rme  samples
       bench    d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+"
  `)
})

test('`bench.withBaseline.perProject()` records a task with both flags, shows in both tables', async () => {
  const { tasks, inlineTable, crossProjectSection } = await runComposition(
    `bench.withBaseline.perProject('combined', () => {})`,
  )
  expect(tasks).toHaveLength(1)
  assertFlags(tasks[0], 'combined', { baseline: true, perProject: true })
  expect(inlineTable).toMatchInlineSnapshot(`
    "     name      hz  min  max  mean  p75  p99  p995  p999   rme  samples
         combined  d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+"
  `)
  expect(crossProjectSection).toMatchInlineSnapshot(`
    "Cross-Project Benchmark Comparison 

      composition.bench.ts > composition > combined
       project  hz  min  max  mean  p75  p99  p995  p999   rme  samples
       bench    d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+"
  `)
})

test('`bench.perProject.withBaseline()` behaves identically to `bench.withBaseline.perProject()`', async () => {
  const { tasks, inlineTable, crossProjectSection } = await runComposition(
    `bench.perProject.withBaseline('combined', () => {})`,
  )
  expect(tasks).toHaveLength(1)
  assertFlags(tasks[0], 'combined', { baseline: true, perProject: true })
  expect(inlineTable).toMatchInlineSnapshot(`
    "     name      hz  min  max  mean  p75  p99  p995  p999   rme  samples
         combined  d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+"
  `)
  expect(crossProjectSection).toMatchInlineSnapshot(`
    "Cross-Project Benchmark Comparison 

      composition.bench.ts > composition > combined
       project  hz  min  max  mean  p75  p99  p995  p999   rme  samples
       bench    d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+"
  `)
})

test('junit reporter embeds the benchmark table inside <system-out>', async () => {
  const { stdout } = await runInlineTests(
    {
      'junit.bench.ts': /* ts */`
        import { test, inject } from 'vitest'

        test('junit benches', async ({ bench }) => {
          await bench.compare(
            bench('a', () => {}),
            bench('b', () => {}),
            inject('options'),
          )
        })
`,
    },
    {
      benchmark: { enabled: true },
      reporters: 'junit',
      provide: { options: fastBenchOptions },
    },
  )

  // extract the <system-out> block from the rendered XML
  // eslint-disable-next-line regexp/no-super-linear-backtracking
  const systemOut = stdout.match(/<system-out>\s*\n([\s\S]*?)<\/system-out>/)?.[1]
  expect(systemOut, stdout).toBeDefined()

  // a header + 2 data rows — reformat through the shared helper so digits
  // collapse to `d+` and widths become measurement-independent
  const tableLines = systemOut!.split('\n').filter(l => l.trim())
  expect(tableLines).toHaveLength(3)
  const [header, ...rows] = tableLines
  const formatted = formatBenchTable([
    header,
    ...rows.map(r => r.replace(/\s+(?:fastest|slowest)\s*$/, '')).sort(),
  ])

  expect(formatted).toMatchInlineSnapshot(`
    "name  hz  min  max  mean  p75  p99  p995  p999   rme  samples
    a     d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+
    b     d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+"
  `)
})

declare module 'vitest' {
  interface ProvidedContext {
    options: typeof fastBenchOptions
  }
}

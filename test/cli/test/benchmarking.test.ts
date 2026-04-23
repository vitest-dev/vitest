import type { BaselineData, BenchResult, TestBenchmark, TestBenchmarkTask } from 'vitest'
import type { JsonTestResults } from 'vitest/node'
import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

// Synthetic stats — just enough to satisfy BenchResult shape for the matchers
// and BaselineData shape for on-disk round-trip tests. All fields beyond
// `mean` are filled with deterministic numbers so snapshots stay stable.
function fakeStats(mean: number) {
  return {
    aad: 0,
    critical: 0,
    df: 0,
    mad: 0,
    max: mean,
    samples: undefined,
    mean,
    min: mean,
    moe: 0,
    p50: mean,
    p75: mean,
    p99: mean,
    p995: mean,
    p999: mean,
    rme: 0,
    samplesCount: 2,
    sd: 0,
    sem: 0,
    variance: 0,
  } as const
}

function fakeBaseline(mean: number): BaselineData {
  return {
    latency: fakeStats(mean),
    throughput: fakeStats(mean > 0 ? 1 / mean : 0),
    period: mean,
    totalTime: mean * 10,
  }
}

function fakeResult(mean: number): BenchResult {
  return {
    ...fakeBaseline(mean),
    name: 'fake',
  } as unknown as BenchResult
}

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
  expect(headerIdx, `inline table header not found in stdout:\n${stdout}`).toBeGreaterThanOrEqual(0)
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
  expect(headerIdx, `inline table header not found in stdout:\n${stdout}`).toBeGreaterThanOrEqual(0)
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

// Runs the given inner-test source as a virtual bench file and asserts the
// inner test case finished in `passed` state (i.e. every `expect` inside the
// bench passed). Lets each outer test push its assertions INTO the inner
// test file and just verify the aggregate outcome.
async function runPassingBench(
  filename: string,
  source: string,
  config: Parameters<typeof runInlineTests>[1] = {},
) {
  const { stderr, results } = await runInlineTests(
    { [filename]: source },
    { benchmark: { enabled: true }, provide: { options: fastBenchOptions }, ...config },
  )
  expect(stderr, `stderr should be empty:\n${stderr}`).toBe('')
  const testCases = [...(results[0]?.children.allTests() ?? [])]
  expect(testCases).toHaveLength(1)
  expect(
    testCases[0].result()?.state,
    JSON.stringify(testCases[0].result()?.errors?.map(e => e.message), null, 2),
  ).toBe('passed')
}

test('`bench()` inside a non-benchmark project throws a helpful error', async () => {
  const { stderr, results } = await runInlineTests(
    {
      'regular.test.ts': /* ts */`
        import { test, expect } from 'vitest'
        test('misuse', async ({ bench }) => {
          expect(() => bench('x', () => {})).toThrow(
            /Cannot use the \`bench\` test-context fixture within a regular test run/,
          )
        })
`,
    },
    { /* benchmark.enabled defaults to false */ },
  )
  expect(stderr).toBe('')
  const testCases = [...(results[0]?.children.allTests() ?? [])]
  expect(testCases).toHaveLength(1)
  expect(testCases[0].result()?.state).toBe('passed')
})

test('`bench.compare()` with zero registrations throws "requires at least 2"', async () => {
  await runPassingBench('zero.bench.ts', /* ts */`
    import { test, expect } from 'vitest'
    test('zero', async ({ bench }) => {
      await expect(bench.compare()).rejects.toThrow(
        /requires at least 2 benchmarks, received 0/,
      )
    })
  `)
})

test('`bench.compare(regA)` with one registration throws and suggests `.run()`', async () => {
  await runPassingBench('one.bench.ts', /* ts */`
    import { test, expect } from 'vitest'
    test('one', async ({ bench }) => {
      await expect(bench.compare(bench('a', () => {}))).rejects.toThrow(
        /received 1.+Consider calling .+bench\\(\\)\\.run\\(\\)/s,
      )
    })
  `)
})

test('`bench.compare(reg, non-reg, reg)` throws the shape error', async () => {
  await runPassingBench('shape.bench.ts', /* ts */`
    import { test, expect } from 'vitest'
    test('shape', async ({ bench }) => {
      await expect(bench.compare(
        bench('a', () => {}),
        { name: 'fake', fn: () => {} },
        bench('b', () => {}),
      )).rejects.toThrow(
        /expects every argument to be the return value of/,
      )
    })
  `)
})

test('`bench.compare` handles all-stored-baselines without running tinybench', async () => {
  // seed the baseline file so compare skips tinybench for BOTH registrations —
  // the bench functions throw to prove they're never called.
  // Key format is `<projectName> > <fullTestName> > <benchName>`; the auto-
  // cloned benchmark project is named "bench" for an unnamed root project.
  const seed = {
    'bench > all cached > a': fakeBaseline(0.5),
    'bench > all cached > b': fakeBaseline(1),
  }
  const { stderr, results } = await runInlineTests(
    {
      'cached.bench.ts': /* ts */`
        import { test, expect } from 'vitest'
        test('all cached', async ({ bench }) => {
          const storage = await bench.compare(
            bench.withBaseline('a', () => { throw new Error('should not run') }),
            bench.withBaseline('b', () => { throw new Error('should not run') }),
          )
          expect(storage.get('a').latency.mean).toBe(0.5)
          expect(storage.get('b').latency.mean).toBe(1)
        })
      `,
      '__benchmarks__/cached.bench.ts.json': JSON.stringify(seed),
    },
    { benchmark: { enabled: true } },
  )
  expect(stderr).toBe('')
  const testCase = [...(results[0]?.children.allTests() ?? [])][0]
  expect(testCase?.result()?.state).toBe('passed')
})

// Baseline key format is `<projectName> > <fullTestName> > <benchName>`.
// The auto-cloned benchmark project for an unnamed root project is named
// `"bench"`, so keys below use the `bench > ` prefix.
test('first `bench.withBaseline` run creates __benchmarks__/<file>.json', async () => {
  const { stderr, fs } = await runInlineTests(
    {
      'foo.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('baseline', async ({ bench }) => {
          await bench.withBaseline('x', () => {}).run(inject('options'))
        })
`,
    },
    { benchmark: { enabled: true }, provide: { options: fastBenchOptions } },
  )
  expect(stderr).toBe('')
  const content = JSON.parse(fs.readFile('__benchmarks__/foo.bench.ts.json'))
  expect(Object.keys(content)).toEqual(['bench > baseline > x'])
  const entry = content['bench > baseline > x']
  expect(typeof entry.latency.mean).toBe('number')
  expect(typeof entry.throughput.mean).toBe('number')
  expect(typeof entry.period).toBe('number')
  expect(typeof entry.totalTime).toBe('number')
})

test('second `bench.withBaseline` run returns the stored result without calling fn', async () => {
  const seed = { 'bench > t > x': fakeBaseline(0.5) }
  await runInlineTests(
    {
      't.bench.ts': /* ts */`
        import { test, expect } from 'vitest'
        test('t', async ({ bench }) => {
          const r = await bench.withBaseline(
            'x',
            () => { throw new Error('should not run') },
          ).run()
          expect(r.latency.mean).toBe(0.5)
        })
`,
      '__benchmarks__/t.bench.ts.json': JSON.stringify(seed),
    },
    { benchmark: { enabled: true } },
  ).then(({ stderr, results }) => {
    expect(stderr).toBe('')
    expect([...(results[0]?.children.allTests() ?? [])][0]?.result()?.state).toBe('passed')
  })
})

test('`benchmark.updateBaselines: true` overwrites a stored baseline', async () => {
  const sentinel = 99999
  const seed = { 'bench > upd > x': fakeBaseline(sentinel) }
  const { stderr, fs } = await runInlineTests(
    {
      'upd.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('upd', async ({ bench }) => {
          await bench.withBaseline('x', () => {}).run(inject('options'))
        })
`,
      '__benchmarks__/upd.bench.ts.json': JSON.stringify(seed),
    },
    { benchmark: { enabled: true, updateBaselines: true }, provide: { options: fastBenchOptions } },
  )
  expect(stderr).toBe('')
  const after = JSON.parse(fs.readFile('__benchmarks__/upd.bench.ts.json'))
  // the sentinel mean is gone — it was overwritten with fresh measurements
  expect(after['bench > upd > x'].latency.mean).not.toBe(sentinel)
})

test('baseline key format includes the project name for multi-project workspaces', async () => {
  const { stderr, fs } = await runInlineTests(
    {
      'shared.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('t', async ({ bench }) => {
          await bench.withBaseline('x', () => {}).run(inject('options'))
        })
`,
    },
    {
      projects: [
        { test: { name: 'one', benchmark: { enabled: true } } },
        { test: { name: 'two', benchmark: { enabled: true } } },
      ],
      provide: { options: fastBenchOptions },
    },
  )
  expect(stderr).toBe('')
  const content = JSON.parse(fs.readFile('__benchmarks__/shared.bench.ts.json'))
  expect(Object.keys(content).sort()).toEqual([
    'one (bench) > t > x',
    'two (bench) > t > x',
  ])
})

test('stored-baseline tasks are emitted WITHOUT the `baseline: true` flag', async () => {
  const tasks: TestBenchmarkTask[] = []
  const seed = { 'bench > t > x': fakeBaseline(0.5) }
  const { stderr } = await runInlineTests(
    {
      't.bench.ts': /* ts */`
        import { test } from 'vitest'
        test('t', async ({ bench }) => {
          await bench.withBaseline(
            'x',
            () => { throw new Error('should not run') },
          ).run()
        })
`,
      '__benchmarks__/t.bench.ts.json': JSON.stringify(seed),
    },
    {
      benchmark: { enabled: true },
      reporters: [{
        onTestCaseBenchmark(_tc, benchmark) {
          tasks.push(...benchmark.tasks)
        },
      }],
    },
  )
  expect(stderr).toBe('')
  expect(tasks).toHaveLength(1)
  expect(tasks[0].name).toBe('x')
  // omitting `baseline: true` avoids triggering a redundant save round-trip
  expect(tasks[0].baseline).toBeUndefined()
})

test('`benchmark.include` overrides the default `*.bench.ts` pattern', async () => {
  const tasks: TestBenchmarkTask[] = []
  const { stderr } = await runInlineTests(
    {
      'a.perf.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('custom include', async ({ bench }) => {
          await bench('x', () => {}).run(inject('options'))
        })
`,
      // this .bench.ts would run under the default pattern — but we override
      'b.bench.ts': /* ts */`
        import { test } from 'vitest'
        test('should not run', async ({ bench }) => {
          await bench('never', () => { throw new Error('not discovered') }).run()
        })
`,
    },
    {
      benchmark: { enabled: true, include: ['**/*.perf.ts'] },
      reporters: [{
        onTestCaseBenchmark(_tc, benchmark) {
          tasks.push(...benchmark.tasks)
        },
      }],
      provide: { options: fastBenchOptions },
    },
  )
  expect(stderr).toBe('')
  expect(tasks.map(t => t.name)).toEqual(['x'])
})

test('`benchmark.exclude` filters matching files out of the bench project', async () => {
  const tasks: TestBenchmarkTask[] = []
  const { stderr } = await runInlineTests(
    {
      'wanted.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('wanted', async ({ bench }) => {
          await bench('x', () => {}).run(inject('options'))
        })
`,
      'skipped.bench.ts': /* ts */`
        import { test } from 'vitest'
        test('should not run', async ({ bench }) => {
          await bench('never', () => { throw new Error('excluded') }).run()
        })
`,
    },
    {
      benchmark: {
        enabled: true,
        exclude: ['**/skipped.bench.ts', '**/node_modules/**'],
      },
      reporters: [{
        onTestCaseBenchmark(_tc, benchmark) {
          tasks.push(...benchmark.tasks)
        },
      }],
      provide: { options: fastBenchOptions },
    },
  )
  expect(stderr).toBe('')
  expect(tasks.map(t => t.name)).toEqual(['x'])
})

test('`benchmark.includeSource` runs in-source benchmarks via `import.meta.vitest`', async () => {
  const tasks: TestBenchmarkTask[] = []
  const { stderr } = await runInlineTests(
    {
      'lib.ts': /* ts */`
        export function add(a: number, b: number) { return a + b }
        if (import.meta.vitest) {
          const { test } = import.meta.vitest
          test('in-source', async ({ bench }) => {
            await bench('add', () => add(1, 2)).run({
              time: 0, iterations: 2, warmupTime: 0, warmupIterations: 0,
            })
          })
        }
`,
    },
    {
      benchmark: { enabled: true, includeSource: ['**/*.ts'] },
      reporters: [{
        onTestCaseBenchmark(_tc, benchmark) {
          tasks.push(...benchmark.tasks)
        },
      }],
    },
  )
  expect(stderr).toBe('')
  expect(tasks.map(t => t.name)).toEqual(['add'])
})

test('`benchmark.retainSamples: true` preserves the raw samples array', async () => {
  const tasks: TestBenchmarkTask[] = []
  const { stderr } = await runInlineTests(
    {
      'samples.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('samples', async ({ bench }) => {
          await bench('x', () => {}).run(inject('options'))
        })
`,
    },
    {
      benchmark: { enabled: true, retainSamples: true },
      reporters: [{
        onTestCaseBenchmark(_tc, benchmark) {
          tasks.push(...benchmark.tasks)
        },
      }],
      provide: { options: fastBenchOptions },
    },
  )
  expect(stderr).toBe('')
  expect(tasks).toHaveLength(1)
  const samples = tasks[0].latency.samples
  expect(Array.isArray(samples)).toBe(true)
  expect(samples!.length).toBeGreaterThanOrEqual(1)
})

test('`benchmark.retainSamples: false` (the default) omits the samples array', async () => {
  const tasks: TestBenchmarkTask[] = []
  const { stderr } = await runInlineTests(
    {
      'nosamples.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('nosamples', async ({ bench }) => {
          await bench('x', () => {}).run(inject('options'))
        })
`,
    },
    {
      benchmark: { enabled: true },
      reporters: [{
        onTestCaseBenchmark(_tc, benchmark) {
          tasks.push(...benchmark.tasks)
        },
      }],
      provide: { options: fastBenchOptions },
    },
  )
  expect(stderr).toBe('')
  expect(tasks).toHaveLength(1)
  expect(tasks[0].latency.samples).toBeUndefined()
})

test('`benchmark.enabled: false` skips .bench.ts files entirely', async () => {
  const names: string[] = []
  const { stderr } = await runInlineTests(
    {
      'ignored.bench.ts': /* ts */`
        import { test } from 'vitest'
        test('should-never-run', () => {
          throw new Error('bench project should not have been created')
        })
`,
      'regular.test.ts': /* ts */`
        import { test } from 'vitest'
        test('runs', () => {})
`,
    },
    {
      // benchmark.enabled defaults to false → no bench project cloned
      reporters: [{
        onTestCaseReady(testCase) {
          names.push(testCase.name)
        },
      }],
    },
  )
  expect(stderr).toBe('')
  expect(names).toEqual(['runs'])
})

test('`vitest bench` CLI invocation filters to the cloned benchmark project', async () => {
  const { stderr, ctx } = await runInlineTests(
    {
      'x.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('x', async ({ bench }) => {
          await bench('a', () => {}).run(inject('options'))
        })
`,
    },
    {
      $cliOptions: { benchmarkOnly: true },
      provide: { options: fastBenchOptions },
    },
  )
  expect(stderr).toBe('')
  // --benchmarkOnly narrows ctx.projects to only bench-enabled projects
  const projectNames = ctx?.projects.map(p => p.name) ?? []
  expect(projectNames).toEqual(['bench'])
})

test('`--update-baselines` CLI flag sets `benchmark.updateBaselines` on every project config', async () => {
  const { stderr, ctx } = await runInlineTests(
    {
      'x.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('x', async ({ bench }) => {
          await bench('a', () => {}).run(inject('options'))
        })
`,
    },
    {
      $cliOptions: { benchmarkOnly: true, updateBaselines: true },
      provide: { options: fastBenchOptions },
    },
  )
  expect(stderr).toBe('')
  // the top-level shorthand AND the per-project benchmark config should both
  // reflect the CLI flag — `resolveConfig` mirrors one into the other so
  // reporters, BenchmarkManager, and runtime all agree
  expect(ctx?.config.updateBaselines).toBe(true)
  const benchProject = ctx?.projects.find(p => p.name === 'bench')
  expect(benchProject?.config.benchmark.updateBaselines).toBe(true)
})

test('json reporter surfaces benchmarks on each assertion result', async () => {
  const { stderr, stdout } = await runInlineTests(
    {
      'foo.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('smoke', async ({ bench }) => {
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
      reporters: 'json',
      provide: { options: fastBenchOptions },
    },
  )
  expect(stderr).toBe('')
  const parsed = JSON.parse(stdout) as JsonTestResults
  const assertionResults = parsed.testResults.flatMap(tr => tr.assertionResults)
  const smoke = assertionResults.find(a => a.title === 'smoke')!
  expect(
    smoke,
    `no assertion result titled "smoke" in json output:\n${JSON.stringify(parsed, null, 2)}`,
  ).toBeDefined()
  expect(Array.isArray(smoke.benchmarks)).toBe(true)
  expect(smoke.benchmarks).toHaveLength(1)
  const [benchmark] = smoke.benchmarks
  expect(benchmark.tasks.map(t => t.name).sort()).toEqual(['a', 'b'])
  // tasks are ranked 1..n and carry the full statistics surface
  expect(benchmark.tasks.map(t => t.rank).sort()).toEqual([1, 2])
  expect(typeof benchmark.tasks[0].latency.mean).toBe('number')
  expect(typeof benchmark.tasks[0].throughput.mean).toBe('number')
})

test('multi-project run aggregates perProject tasks into a single cross-project sub-table', async () => {
  const { stderr, stdout } = await runInlineTests(
    {
      'shared.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('cross', async ({ bench }) => {
          await bench.perProject('x', () => {}).run(inject('options'))
        })
`,
    },
    {
      projects: [
        { test: { name: 'one', benchmark: { enabled: true } } },
        { test: { name: 'two', benchmark: { enabled: true } } },
      ],
      reporters: ['default'],
      provide: { options: fastBenchOptions },
    },
  )
  expect(stderr).toBe('')
  expect(stdout).toContain('Cross-Project Benchmark Comparison')

  // find the `project ... hz ... min` header of the `x` sub-table + 2 data rows
  const lines = stdout.split('\n')
  const headerIdx = lines.findIndex(l => /^\s*project\s+hz\s+min/.test(l))
  expect(headerIdx, `cross-project sub-table header not found in stdout:\n${stdout}`).toBeGreaterThan(-1)
  const [header, ...rows] = lines.slice(headerIdx, headerIdx + 3)
  const normalized = formatBenchTable([
    header,
    ...rows.map(r => r.replace(/\s+(?:fastest|slowest)\s*$/, '')).sort(),
  ])
  expect(normalized).toMatchInlineSnapshot(`
    "   project      hz  min  max  mean  p75  p99  p995  p999   rme  samples
       one (bench)  d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+
       two (bench)  d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+"
  `)
})

test('cross-project section is absent when no benchmark is perProject', async () => {
  const { stderr, stdout } = await runInlineTests(
    {
      'nox.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('no perProject', async ({ bench }) => {
          await bench('only', () => {}).run(inject('options'))
        })
`,
    },
    {
      benchmark: { enabled: true },
      reporters: ['default'],
      provide: { options: fastBenchOptions },
    },
  )
  expect(stderr).toBe('')
  expect(stdout).not.toContain('Cross-Project Benchmark Comparison')
})

test('stored `withBaseline.perProject` tasks keep `perProject: true` when re-emitted', async () => {
  const tasks: TestBenchmarkTask[] = []
  const seed = { 'bench > combined > x': fakeBaseline(0.5) }
  const { stderr } = await runInlineTests(
    {
      'combined.bench.ts': /* ts */`
        import { test } from 'vitest'
        test('combined', async ({ bench }) => {
          await bench.withBaseline.perProject(
            'x',
            () => { throw new Error('should not run') },
          ).run()
        })
`,
      '__benchmarks__/combined.bench.ts.json': JSON.stringify(seed),
    },
    {
      benchmark: { enabled: true },
      reporters: [{
        onTestCaseBenchmark(_tc, benchmark) {
          tasks.push(...benchmark.tasks)
        },
      }],
    },
  )
  expect(stderr).toBe('')
  expect(tasks).toHaveLength(1)
  expect(tasks[0]).toMatchObject({ name: 'x', perProject: true })
  // baseline flag is intentionally stripped on re-emitted stored baselines
  expect(tasks[0].baseline).toBeUndefined()
})

test('`bench.compare` wraps multiple failed benchmarks in an AggregateError', async () => {
  await runPassingBench('aggregate.bench.ts', /* ts */`
    import { test, expect, inject } from 'vitest'
    test('aggregate errors', async ({ bench }) => {
      const err = await bench.compare(
        bench('a', () => { throw new Error('A failed') }),
        bench('b', () => { throw new Error('B failed') }),
        inject('options'),
      ).catch(e => e)
      expect(err).toBeInstanceOf(AggregateError)
      expect(err.message).toBe('Some benchmarks failed')
      const messages = err.errors.map((e) => e.message).sort()
      expect(messages).toEqual(['A failed', 'B failed'])
    })
  `)
})

test('`BenchStorage.get` returns a valid BenchResult shape for every registration', async () => {
  await runPassingBench('storage.bench.ts', /* ts */`
    import { test, expect, inject } from 'vitest'
    test('storage shape', async ({ bench }) => {
      const storage = await bench.compare(
        bench('a', () => {}),
        bench('b', () => {}),
        inject('options'),
      )
      for (const name of ['a', 'b'] as const) {
        const result = storage.get(name)
        expect(typeof result.latency.mean).toBe('number')
        expect(typeof result.throughput.mean).toBe('number')
        expect(typeof result.period).toBe('number')
        expect(typeof result.totalTime).toBe('number')
      }
    })
  `)
})

test('`bench.compare` trailing options propagate through to the underlying Tinybench', async () => {
  const benchmarks: TestBenchmark[] = []
  const { stderr } = await runInlineTests(
    {
      'options.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('options', async ({ bench }) => {
          await bench.compare(
            bench('a', () => {}),
            bench('b', () => {}),
            { ...inject('options'), name: 'custom-bench-name' },
          )
        })
`,
    },
    {
      benchmark: { enabled: true },
      reporters: [{
        onTestCaseBenchmark(_tc, benchmark) {
          benchmarks.push(benchmark)
        },
      }],
      provide: { options: fastBenchOptions },
    },
  )
  expect(stderr).toBe('')
  expect(benchmarks).toHaveLength(1)
  // user-supplied `name` overrides the default `<fullTestName> <idx>` label;
  // the serialized benchmark emitted to reporters carries it verbatim
  expect(benchmarks[0].name).toBe('custom-bench-name')
})

test('`BenchStorage.get("missing")` throws a descriptive error', async () => {
  await runPassingBench('missing.bench.ts', /* ts */`
    import { test, expect, inject } from 'vitest'
    test('missing', async ({ bench }) => {
      const storage = await bench.compare(
        bench('a', () => {}),
        bench('b', () => {}),
        inject('options'),
      )
      expect(() => storage.get('missing')).toThrow(
        /task "missing" was not defined/,
      )
    })
  `)
})

test('`toBeFasterThan` passes when actual.latency.mean is strictly smaller', () => {
  expect(fakeResult(0.5)).toBeFasterThan(fakeResult(1.0))
})

test('`toBeFasterThan` fails with a percent-slower message when actual is slower', () => {
  expect(() => expect(fakeResult(1.0)).toBeFasterThan(fakeResult(0.5)))
    .toThrowErrorMatchingInlineSnapshot(`
      [Error: [2mexpect([22m[31mreceived[39m[2m).toBeFasterThan([22m[32mexpected[39m[2m)[22m

      Expected to be faster, but was 100.00% slower.

      Received: [31m1.00[39m ops/sec
      Expected: [32m2.00[39m ops/sec
      ]
    `)
})

test('`toBeFasterThan` honours the `delta` threshold', () => {
  const fast = fakeResult(0.8) // 20% faster than 1.0
  const slow = fakeResult(1.0)
  // 20% faster is not enough when delta demands 30%
  expect(() => expect(fast).toBeFasterThan(slow, { delta: 0.3 }))
    .toThrow(/faster by at least 30%/)
  // passes when the demanded margin is only 10%
  expect(fast).toBeFasterThan(slow, { delta: 0.1 })
})

test('`toBeSlowerThan` passes when actual.latency.mean is strictly larger', () => {
  expect(fakeResult(1.0)).toBeSlowerThan(fakeResult(0.5))
})

test('`toBeSlowerThan` fails with a percent-faster message when actual is faster', () => {
  expect(() => expect(fakeResult(0.5)).toBeSlowerThan(fakeResult(1.0)))
    .toThrowErrorMatchingInlineSnapshot(`
      [Error: [2mexpect([22m[31mreceived[39m[2m).toBeSlowerThan([22m[32mexpected[39m[2m)[22m

      Expected to be slower, but was 50% faster.

      Received: [31m2.00[39m ops/sec
      Expected: [32m1.00[39m ops/sec
      ]
    `)
})

test('`toBeSlowerThan` honours the `delta` threshold', () => {
  // slow = 2x fast → 100% slower. delta 0.5 → threshold 150% → passes at 100%
  expect(fakeResult(1.0)).toBeSlowerThan(fakeResult(0.5), { delta: 0.5 })
  expect(() => expect(fakeResult(1.0)).toBeSlowerThan(fakeResult(0.5), { delta: 1.5 }))
    .toThrow(/slower by at least 150%/)
})

test('bench matchers reject non-benchmark-result values with a TypeError', () => {
  expect(() => expect({ foo: 'bar' }).toBeFasterThan(fakeResult(1.0)))
    .toThrow(TypeError)
  expect(() => expect(fakeResult(1.0)).toBeFasterThan({ foo: 'bar' } as any))
    .toThrow(TypeError)
  expect(() => expect({ foo: 'bar' }).toBeSlowerThan(fakeResult(1.0)))
    .toThrow(TypeError)
})

declare module 'vitest' {
  interface ProvidedContext {
    options: typeof fastBenchOptions
  }
}

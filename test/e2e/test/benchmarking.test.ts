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
        import { test, expect, inject } from 'vitest'

        test('bench signatures', async ({ bench }) => {
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

          // consume the registrations so the unrun-bench warning stays silent
          await bench.compare(withOpts, noOpts, inject('options'))
        })
`,
    },
    { benchmark: { enabled: true }, provide: { options: fastBenchOptions } },
  )

  expect(stderr).toBe('')
  const testCases = [...(results[0]?.children.allTests() ?? [])]
  expect(testCases).toHaveLength(1)
  expect(testCases[0].result()?.state).toBe('passed')
})

test('bench exposes plain and perProject compositions and prints a table', async () => {
  const tasks: TestBenchmarkTask[] = []

  const { stderr, stdout } = await runInlineTests(
    {
      'compositions.bench.ts': /* ts */`
        import { test, inject } from 'vitest'

        test('all compositions', async ({ bench }) => {
          await bench.compare(
            bench('plain', () => {}),
            bench('perProject', { perProject: true }, () => {}),
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
    tasks.map(t => [t.name, { perProject: !!t.perProject }]),
  )
  expect(byName).toEqual({
    plain: { perProject: false },
    perProject: { perProject: true },
  })

  // snapshot the rendered inline benchmark table. Rows are sorted by name so
  // measurement-driven rank ordering doesn't reshuffle them, and the
  // rank-dependent fastest/slowest suffix is stripped.
  const lines = stdout.split('\n')
  const headerIdx = lines.findIndex(l => /^\s*name\s+hz\s+min/.test(l))
  expect(headerIdx, `inline table header not found in stdout:\n${stdout}`).toBeGreaterThanOrEqual(0)
  const [header, ...rows] = lines.slice(headerIdx, headerIdx + 3)
  const normalized = formatBenchTable([
    header,
    ...rows.map(r => r.replace(/\s+(?:fastest|slowest)\s*$/, '')).sort(),
  ])

  expect(normalized).toMatchInlineSnapshot(`
    "     name        hz  min  max  mean  p75  p99  p995  p999   rme  samples
         perProject  d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+
         plain       d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+"
  `)

  // Only one project ran, so the cross-project section is skipped — a
  // single-row comparison has nothing to compare against.
  expect(stdout).not.toContain('Cross-Project Benchmark Comparison')
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

function assertFlags(task: TestBenchmarkTask, name: string, flags: { perProject?: true }) {
  expect(task.name).toBe(name)
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

test('`bench(..., { perProject: true }, fn)` records a perProject task in the inline table; cross-project section is omitted with only one project', async () => {
  const { tasks, inlineTable, crossProjectSection } = await runComposition(
    `bench('perProject', { perProject: true }, () => {})`,
  )
  expect(tasks).toHaveLength(1)
  assertFlags(tasks[0], 'perProject', { perProject: true })
  expect(inlineTable).toMatchInlineSnapshot(`
    "     name        hz  min  max  mean  p75  p99  p995  p999   rme  samples
         perProject  d+   d+   d+    d+   d+   d+    d+    d+  ±d+%       d+"
  `)
  expect(crossProjectSection).toBeNull()
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

test('`bench(name, { writeResult }, fn)` writes a result file at the given path', async () => {
  const { stderr, fs } = await runInlineTests(
    {
      'foo.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('write', async ({ bench }) => {
          await bench('x', { writeResult: './out/x.json' }, () => {}).run(inject('options'))
        })
`,
    },
    {
      benchmark: { enabled: true },
      provide: { options: fastBenchOptions },
    },
  )
  expect(stderr).toBe('')
  const content = JSON.parse(fs.readFile('out/x.json'))
  expect(typeof content.latency.mean).toBe('number')
  expect(typeof content.throughput.mean).toBe('number')
  expect(typeof content.period).toBe('number')
  expect(typeof content.totalTime).toBe('number')
})

test('`writeResult` is overwritten on every successful run', async () => {
  // seed a file with a sentinel value, then run the benchmark — the run
  // must replace the sentinel with fresh measurements
  const sentinel = fakeBaseline(99999)
  const { stderr, fs } = await runInlineTests(
    {
      'upd.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('upd', async ({ bench }) => {
          await bench('x', { writeResult: './out/upd.json' }, () => {}).run(inject('options'))
        })
`,
      'out/upd.json': JSON.stringify(sentinel),
    },
    { benchmark: { enabled: true }, provide: { options: fastBenchOptions } },
  )
  expect(stderr).toBe('')
  const after = JSON.parse(fs.readFile('out/upd.json'))
  expect(after.latency.mean).not.toBe(99999)
})

// eslint-disable-next-line no-template-curly-in-string
test('`writeResult` substitutes `${projectName}` so multi-project runs do not collide', async () => {
  const { stderr, fs } = await runInlineTests(
    {
      'shared.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('t', async ({ bench }) => {
          await bench(
            'x',
            { writeResult: './out/x.\${projectName}.json' },
            () => {},
          ).run(inject('options'))
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
  // ${projectName} substitutes to the parent project name (not the cloned
  // bench project name) so users never see the internal " (bench)" suffix
  // bleed into their paths.
  expect(typeof JSON.parse(fs.readFile('out/x.one.json')).latency.mean).toBe('number')
  expect(typeof JSON.parse(fs.readFile('out/x.two.json')).latency.mean).toBe('number')
})

test('`writeResult` does NOT write a file when the benchmark throws', async () => {
  const { fs } = await runInlineTests(
    {
      'throw.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('throws', async ({ bench }) => {
          try {
            await bench(
              'x',
              { writeResult: './out/should-not-exist.json' },
              () => { throw new Error('boom') },
            ).run(inject('options'))
          } catch {}
        })
`,
    },
    { benchmark: { enabled: true }, provide: { options: fastBenchOptions } },
  )
  expect(() => fs.readFile('out/should-not-exist.json')).toThrow()
})

test('`bench.from(name, path)` reads a stored result without invoking any function', async () => {
  const seed = fakeBaseline(0.5)
  const { stderr, results } = await runInlineTests(
    {
      'read.bench.ts': /* ts */`
        import { test, expect } from 'vitest'
        test('read', async ({ bench }) => {
          const r = await bench.from('previous', './out/seed.json').run()
          expect(r.latency.mean).toBe(0.5)
        })
`,
      'out/seed.json': JSON.stringify(seed),
    },
    { benchmark: { enabled: true } },
  )
  expect(stderr).toBe('')
  expect([...(results[0]?.children.allTests() ?? [])][0]?.result()?.state).toBe('passed')
})

test('`bench.from(name, fn)` awaits the function and treats its return value as the result', async () => {
  await runPassingBench('readfn.bench.ts', /* ts */`
    import { test, expect } from 'vitest'
    test('read via function', async ({ bench }) => {
      const data = {
        latency: { mean: 0.42, min: 0.42, max: 0.42, samplesCount: 1 },
        throughput: { mean: 1, min: 1, max: 1, samplesCount: 1 },
        period: 0.42,
        totalTime: 0.42,
      }
      const r = await bench.from('previous', () => Promise.resolve(data)).run()
      expect(r.latency.mean).toBe(0.42)
    })
  `)
})

test('`bench.from()` raises a helpful error when the file is missing', async () => {
  await runPassingBench('missingfile.bench.ts', /* ts */`
    import { test, expect } from 'vitest'
    test('missing file', async ({ bench }) => {
      await expect(bench.from('x', './does-not-exist.json').run()).rejects.toThrow(
        /could not find a result file at/,
      )
    })
  `)
})

test('`bench.from()` rejects a path that escapes the project root', async () => {
  await runPassingBench('escape.bench.ts', /* ts */`
    import { test, expect } from 'vitest'
    test('escape', async ({ bench }) => {
      await expect(bench.from('x', '../package.json').run()).rejects.toThrow(
        /resolves outside the project root/,
      )
    })
  `)
})

test('`bench.compare` with a live `writeResult` AND a `bench.from()` records both tasks', async () => {
  const seed = fakeBaseline(0.5)
  const tasks: TestBenchmarkTask[] = []
  const { stderr, results } = await runInlineTests(
    {
      'mixed.bench.ts': /* ts */`
        import { test, expect, inject } from 'vitest'
        test('mixed', async ({ bench }) => {
          const storage = await bench.compare(
            bench('current', { writeResult: './out/current.json' }, () => {}),
            bench.from('previous', './out/previous.json'),
            inject('options'),
          )
          expect(storage.get('previous').latency.mean).toBe(0.5)
          expect(typeof storage.get('current').latency.mean).toBe('number')
        })
`,
      'out/previous.json': JSON.stringify(seed),
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
  expect([...(results[0]?.children.allTests() ?? [])][0]?.result()?.state).toBe('passed')
  // both rows appear in the same TestBenchmark, with the from() row marked
  expect(tasks.map(t => ({ name: t.name, fromStore: !!t.fromStore })).sort((a, b) => a.name.localeCompare(b.name)))
    .toEqual([
      { name: 'current', fromStore: false },
      { name: 'previous', fromStore: true },
    ])
})

test('`bench.compare` with only `bench.from()` registrations skips tinybench entirely', async () => {
  const a = fakeBaseline(0.5)
  const b = fakeBaseline(1)
  const tasks: TestBenchmarkTask[] = []
  const { stderr, results } = await runInlineTests(
    {
      'only-from.bench.ts': /* ts */`
        import { test, expect } from 'vitest'
        test('only from', async ({ bench }) => {
          const storage = await bench.compare(
            bench.from('a', './out/a.json'),
            bench.from('b', './out/b.json'),
          )
          expect(storage.get('a').latency.mean).toBe(0.5)
          expect(storage.get('b').latency.mean).toBe(1)
        })
`,
      'out/a.json': JSON.stringify(a),
      'out/b.json': JSON.stringify(b),
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
  expect([...(results[0]?.children.allTests() ?? [])][0]?.result()?.state).toBe('passed')
  expect(tasks.every(t => t.fromStore)).toBe(true)
})

test('`bench.from()` rows render rme and samples columns from the stored data', async () => {
  // The on-disk BaselineData includes the full `latency` Statistics — including
  // `rme` and `samplesCount` — so a stored row should display real numbers in
  // those columns, not placeholder dashes.
  const seed = { ...fakeBaseline(0.5), latency: { ...fakeStats(0.5), rme: 1.23, samplesCount: 7 } }
  const { stderr, stdout } = await runInlineTests(
    {
      'render.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('render', async ({ bench }) => {
          await bench.compare(
            bench('live', () => {}),
            bench.from('stored', './out/from.json'),
            inject('options'),
          )
        })
`,
      'out/from.json': JSON.stringify(seed),
    },
    {
      benchmark: { enabled: true },
      reporters: ['default'],
      provide: { options: fastBenchOptions },
    },
  )
  expect(stderr).toBe('')
  const lines = stdout.split('\n')
  const headerIdx = lines.findIndex(l => /^\s*name\s+hz\s+min/.test(l))
  expect(headerIdx, `inline table header not found in stdout:\n${stdout}`).toBeGreaterThanOrEqual(0)
  // The header columns are: name, hz, min, max, mean, p75, p99, p995, p999, rme, samples.
  // Find the row for "stored" and inspect its last two cells.
  const storedRow = lines.slice(headerIdx + 1, headerIdx + 3).find(l => /^\s*stored\b/.test(l))!
  expect(storedRow, `stored row not found in:\n${stdout}`).toBeDefined()
  const cells = storedRow.trim().replace(/\s+(?:fastest|slowest)\s*$/, '').split(/\s+/)
  // rme + samples must be real values, not the `-` placeholder
  expect(cells[cells.length - 2]).toBe('±1.23%')
  expect(cells[cells.length - 1]).toBe('7')
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
          await bench('x', { perProject: true }, () => {}).run(inject('options'))
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

test('cross-project section is skipped when every perProject benchmark ran in only one project', async () => {
  // Even when several perProject benchmarks are recorded, the cross-project
  // table is useless if each one ran in exactly one project — every sub-table
  // would be a single row with nothing to compare against.
  const { stderr, stdout } = await runInlineTests(
    {
      'solo.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('solo', async ({ bench }) => {
          await bench.compare(
            bench('a', { perProject: true }, () => {}),
            bench('b', { perProject: true }, () => {}),
            inject('options'),
          )
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

test('benchmark warns when module export getters are accessed too many times', async () => {
  const { stderr } = await runInlineTests(
    {
      'fixture.ts': /* ts */`
        export const value = 1
`,
      'getter-warning.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        import * as fixture from './fixture'

        test('getter warning', async ({ bench }) => {
          await bench('read getter', () => {
            for (let i = 0; i < 1_000_001; i++) {
              void fixture.value
            }
          }).run(inject('options'))
        })
`,
    },
    {
      benchmark: { enabled: true },
      provide: { options: { ...fastBenchOptions, iterations: 1 } },
    },
  )

  expect(stderr).toMatchInlineSnapshot(`
    "stderr | getter-warning.bench.ts > getter warning
    Benchmark Warning
    Benchmark "getter warning 1" accessed module export getters too many times.

    This can make results unreliable because export getters add overhead.
    See https://vitest.dev/guide/benchmarking#module-runner-overhead

    Tracked exports:
      - fixture.ts > value

    "
  `)
})

test('benchmark export getter warning can be suppressed', async () => {
  const { stderr } = await runInlineTests(
    {
      'fixture.ts': /* ts */`
        export const value = 1
`,
      'getter-warning.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        import * as fixture from './fixture'

        test('getter warning', async ({ bench }) => {
          await bench('read getter', () => {
            for (let i = 0; i < 1_000_001; i++) {
              void fixture.value
            }
          }).run(inject('options'))
        })
`,
    },
    {
      benchmark: { enabled: true, suppressExportGetterWarnings: true },
      provide: { options: { ...fastBenchOptions, iterations: 1 } },
    },
  )

  expect(stderr).toBe('')
})

test('warns when `bench()` is registered but never run', async () => {
  const { stderr } = await runInlineTests(
    {
      'unrun.bench.ts': /* ts */`
        import { test } from 'vitest'
        test('forgot to run', ({ bench }) => {
          bench('a', () => {})
        })
`,
    },
    { benchmark: { enabled: true } },
  )
  expect(stderr).toContain('Benchmark Warning')
  expect(stderr).toContain('forgot to run')
  expect(stderr).toContain('"a"')
})

test('warns about every unrun registration in the message, including `bench.from()`', async () => {
  const { stderr } = await runInlineTests(
    {
      'out/seed.json': JSON.stringify(fakeBaseline(0.5)),
      'multi.bench.ts': /* ts */`
        import { test } from 'vitest'
        test('multi unrun', ({ bench }) => {
          bench('a', () => {})
          bench('b', () => {})
          bench.from('seed', './out/seed.json')
        })
`,
    },
    { benchmark: { enabled: true } },
  )
  expect(stderr).toContain('Benchmark Warning')
  // every name appears in a single warning line
  expect(stderr).toMatch(/"a".+"b".+"seed"/)
})

test('does NOT warn when every registration is consumed by `.run()` or `bench.compare()`', async () => {
  const { stderr } = await runInlineTests(
    {
      'consumed.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('all consumed', async ({ bench }) => {
          await bench('lone', () => {}).run(inject('options'))
          await bench.compare(
            bench('x', () => {}),
            bench('y', () => {}),
            inject('options'),
          )
        })
`,
    },
    { benchmark: { enabled: true }, provide: { options: fastBenchOptions } },
  )
  expect(stderr).toBe('')
})

test('warns only about the unrun registration when others are consumed', async () => {
  const { stderr } = await runInlineTests(
    {
      'partial.bench.ts': /* ts */`
        import { test, inject } from 'vitest'
        test('partial', async ({ bench }) => {
          await bench('used', () => {}).run(inject('options'))
          bench('forgotten', () => {})
        })
`,
    },
    { benchmark: { enabled: true }, provide: { options: fastBenchOptions } },
  )
  expect(stderr).toContain('Benchmark Warning')
  expect(stderr).toContain('"forgotten"')
  expect(stderr).not.toContain('"used"')
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
      JestExtendError {
        "message": "[2mexpect([22m[31mreceived[39m[2m).toBeFasterThan([22m[32mexpected[39m[2m)[22m

      Expected to be faster, but was 100.00% slower.

      Received: [31m1.00[39m ops/sec
      Expected: [32m2.00[39m ops/sec
      ",
        "actual": undefined,
        "expected": undefined,
        "__vitest_error_context__": {
          "assertionName": "toBeFasterThan",
          "meta": undefined,
        },
      }
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
      JestExtendError {
        "message": "[2mexpect([22m[31mreceived[39m[2m).toBeSlowerThan([22m[32mexpected[39m[2m)[22m

      Expected to be slower, but was 50% faster.

      Received: [31m2.00[39m ops/sec
      Expected: [32m1.00[39m ops/sec
      ",
        "actual": undefined,
        "expected": undefined,
        "__vitest_error_context__": {
          "assertionName": "toBeSlowerThan",
          "meta": undefined,
        },
      }
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

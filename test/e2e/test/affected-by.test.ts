import type { Reporter } from 'vitest/node'
import { relative } from 'pathe'
import { expect, test } from 'vitest'
import { runInlineTests, runVitest } from '#test-utils'

function testFile(name: string, imports = '') {
  return `
    ${imports}
    import { test } from 'vitest'
    test('${name}', () => {})
  `
}

// `affectedBy` of every specification, for every run
function useAffectedBy() {
  const runs: Record<string, string[] | undefined>[] = []
  const reporter: Reporter = {
    onTestRunStart(specifications) {
      runs.push(
        Object.fromEntries(
          specifications.map((spec) => {
            const root = spec.project.vitest.config.root
            const files =
              spec.affectedBy && Array.from(spec.affectedBy, (file) => relative(root, file))
            return [relative(root, spec.moduleId), files?.sort()]
          }),
        ),
      )
    },
  }
  return { runs, reporter }
}

test('a test is affected by the changed files that it imports', async () => {
  const { runs, reporter } = useAffectedBy()
  const { stderr } = await runInlineTests(
    {
      'src/helper.js': `import './nested.js'`,
      'src/nested.js': 'export {}',
      'src/other.js': 'export {}',
      'src/unrelated.js': 'export {}',
      'a.test.js': testFile('a', `import './src/helper.js'\nimport './src/other.js'`),
      'b.test.js': testFile('b', `import './src/other.js'`),
      'c.test.js': testFile('c'),
      'd.test.js': testFile('d'),
    },
    {
      related: ['src/nested.js', 'src/other.js', 'src/unrelated.js', 'c.test.js'],
      reporters: [reporter],
    },
  )

  expect(stderr).toBe('')
  expect(runs).toMatchInlineSnapshot(`
    [
      {
        "a.test.js": [
          "src/nested.js",
          "src/other.js",
        ],
        "b.test.js": [
          "src/other.js",
        ],
        "c.test.js": [
          "c.test.js",
        ],
      },
    ]
  `)
})

test('a changed snapshot is added to the changed imports of the test', async () => {
  const { runs, reporter } = useAffectedBy()
  const { stderr } = await runInlineTests(
    {
      'src/helper.js': 'export const value = "a"',
      'a.test.js': `
        import { expect, test } from 'vitest'
        import { value } from './src/helper.js'
        test('a', () => { expect(value).toMatchSnapshot() })
      `,
      '__snapshots__/a.test.js.snap': '// Vitest Snapshot v1\n\nexports[`a 1`] = `"a"`;\n',
      'b.test.js': testFile('b'),
    },
    { related: ['src/helper.js', '__snapshots__/a.test.js.snap'], reporters: [reporter] },
  )

  expect(stderr).toBe('')
  expect(runs).toMatchInlineSnapshot(`
    [
      {
        "a.test.js": [
          "__snapshots__/a.test.js.snap",
          "src/helper.js",
        ],
      },
    ]
  `)
})

test('a module mocked with a factory does not affect the test', async () => {
  const { runs, reporter } = useAffectedBy()
  const { stderr } = await runInlineTests(
    {
      'src/helper.js': 'export const helper = 1',
      'src/other.js': 'export const other = 1',
      'a.test.js': testFile(
        'a',
        `import { vi } from 'vitest'
        import './src/helper.js'
        import './src/other.js'
        vi.mock('./src/helper.js', () => ({ helper: 2 }))`,
      ),
      'b.test.js': testFile('b', `import './src/helper.js'`),
    },
    { related: ['src/helper.js', 'src/other.js'], reporters: [reporter] },
  )

  expect(stderr).toBe('')
  expect(runs).toMatchInlineSnapshot(`
    [
      {
        "a.test.js": [
          "src/other.js",
        ],
        "b.test.js": [
          "src/helper.js",
        ],
      },
    ]
  `)
})

test('every test is affected only by the change that a setup file imports', async () => {
  const { runs, reporter } = useAffectedBy()
  const { stderr } = await runInlineTests(
    {
      'vitest.config.js': { test: { setupFiles: ['./setup.js'] } },
      'setup.js': `import './src/setup-helper.js'`,
      'src/setup-helper.js': 'export {}',
      'src/helper.js': 'export {}',
      'a.test.js': testFile('a', `import './src/helper.js'`),
      'b.test.js': testFile('b'),
    },
    { related: ['src/setup-helper.js', 'src/helper.js'], reporters: [reporter] },
  )

  expect(stderr).toBe('')
  expect(runs).toMatchInlineSnapshot(`
    [
      {
        "a.test.js": [
          "src/setup-helper.js",
        ],
        "b.test.js": [
          "src/setup-helper.js",
        ],
      },
    ]
  `)
})

test('a changed config file affects every test', async () => {
  const { runs, reporter } = useAffectedBy()
  const { stderr } = await runInlineTests(
    {
      'vitest.config.js': `export default {}`,
      'a.test.js': testFile('a'),
      'b.test.js': testFile('b'),
    },
    { related: ['vitest.config.js'], reporters: [reporter] },
  )

  expect(stderr).toBe('')
  expect(runs).toMatchInlineSnapshot(`
    [
      {
        "a.test.js": [
          "vitest.config.js",
        ],
        "b.test.js": [
          "vitest.config.js",
        ],
      },
    ]
  `)
})

test('a force rerun trigger affects every test', async () => {
  const { runs, reporter } = useAffectedBy()
  const { stderr } = await runInlineTests(
    {
      'vitest.config.js': { test: { forceRerunTriggers: ['**/fixtures/**'] } },
      'fixtures/data.json': '{}',
      'src/helper.js': 'export {}',
      'a.test.js': testFile('a', `import './src/helper.js'`),
      'b.test.js': testFile('b'),
    },
    { related: ['fixtures/data.json', 'src/helper.js'], reporters: [reporter] },
  )

  expect(stderr).toBe('')
  expect(runs).toMatchInlineSnapshot(`
    [
      {
        "a.test.js": [
          "fixtures/data.json",
        ],
        "b.test.js": [
          "fixtures/data.json",
        ],
      },
    ]
  `)
})

test('a module that fails to load affects the tests that import it', async () => {
  const { runs, reporter } = useAffectedBy()
  await runInlineTests(
    {
      'src/helper.js': `import './deleted.js'`,
      'a.test.js': testFile('a', `import './src/helper.js'`),
      'b.test.js': testFile('b'),
    },
    { related: ['src/deleted.js'], reporters: [reporter] },
  )

  expect(runs).toMatchInlineSnapshot(`
    [
      {
        "a.test.js": [
          "src/helper.js",
        ],
      },
    ]
  `)
})

test('recorded dependencies affect the test, a test without a record has no files', async () => {
  const recorded = { cache: true, experimental: { recordDependencies: true } }
  const { fs, stderr } = await runInlineTests(
    {
      'src/helper.js': 'export {}',
      'src/other.js': 'export {}',
      'a.test.js': testFile('a', `import './src/helper.js'`),
      'b.test.js': testFile('b', `import './src/other.js'`),
    },
    recorded,
  )
  expect(stderr).toBe('')

  fs.createFile('c.test.js', testFile('c'))
  const { runs, reporter } = useAffectedBy()
  const changed = await runVitest({
    root: fs.root,
    ...recorded,
    related: ['src/helper.js'],
    reporters: [reporter],
  })

  expect(changed.stderr).toBe('')
  expect(runs).toMatchInlineSnapshot(`
    [
      {
        "a.test.js": [
          "src/helper.js",
        ],
        "c.test.js": [],
      },
    ]
  `)
})

test('a test that failed in the previous run has no files', async () => {
  const sinceLastRun = { cache: true, $cliOptions: { sinceLastRun: true } }
  const { fs } = await runInlineTests(
    {
      'a.test.js': testFile('a'),
      'b.test.js': `
        import { expect, test } from 'vitest'
        test('b', () => {
          expect(process.env.DATABASE_URL).toBeDefined()
        })
      `,
    },
    sinceLastRun,
  )

  const { runs, reporter } = useAffectedBy()
  await runVitest({ root: fs.root, ...sinceLastRun, reporters: [reporter] })

  expect(runs).toMatchInlineSnapshot(`
    [
      {
        "b.test.js": [],
      },
    ]
  `)
})

test('a failed test keeps its files with --last-failed', async () => {
  const { fs } = await runInlineTests(
    {
      'src/helper.js': 'export const value = 1',
      'a.test.js': `
        import { expect, test } from 'vitest'
        import { value } from './src/helper.js'
        test('fails', () => { expect(value).toBe(2) })
        test('passes', () => {})
      `,
      'b.test.js': `
        import { expect, test } from 'vitest'
        test('fails', () => { expect(1).toBe(2) })
      `,
    },
    { cache: true },
  )

  const { runs, reporter } = useAffectedBy()
  await runVitest({
    root: fs.root,
    cache: true,
    related: ['src/helper.js'],
    $cliOptions: { lastFailed: true },
    reporters: [reporter],
  })

  expect(runs).toMatchInlineSnapshot(`
    [
      {
        "a.test.js": [
          "src/helper.js",
        ],
      },
    ]
  `)
})

test('a rerun in watch mode is not affected by the files of the first run', async () => {
  const { runs, reporter } = useAffectedBy()
  const { ctx, stderr } = await runInlineTests(
    {
      'src/helper.js': 'export {}',
      'a.test.js': testFile('a', `import './src/helper.js'`),
      'b.test.js': testFile('b'),
    },
    { watch: true, related: ['src/helper.js'], reporters: [reporter] },
  )
  await ctx!.rerunFiles()

  expect(stderr).toBe('')
  expect(runs).toMatchInlineSnapshot(`
    [
      {
        "a.test.js": [
          "src/helper.js",
        ],
      },
      {
        "a.test.js": undefined,
      },
    ]
  `)
})

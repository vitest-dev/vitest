import { readFileSync, rmSync } from 'node:fs'
import { relative } from 'pathe'
import { expect, test } from 'vitest'
import { runInlineTests, runVitest } from '../../test-utils'

const recorded = { cache: true, experimental: { recordDependencies: true, vcsProvider: 'mtime' } }

function testFile(name: string, imports = '') {
  return `
    ${imports}
    import { test } from 'vitest'
    test('${name}', () => {})
  `
}

const files = {
  'src/helper.js': 'export {}',
  'src/other.js': 'export {}',
  'a.test.js': testFile('a', `import './src/helper.js'`),
  'b.test.js': testFile('b', `import './src/other.js'`),
}

test('runs the tests that loaded a file modified after their last run', async () => {
  const { fs, stderr } = await runInlineTests(files, recorded)
  expect(stderr).toBe('')

  fs.editFile('src/helper.js', () => 'export const helper = 1')
  const changed = await runVitest({ root: fs.root, ...recorded, changed: true })
  expect(changed.stderr).toBe('')
  expect(changed.testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "passed",
      },
    }
  `)

  // the run above recorded the file again, so nothing is newer than the records
  const unchanged = await runVitest({ root: fs.root, ...recorded, changed: true })
  expect(unchanged.stderr).toBe('')
  expect(unchanged.ctx!._sourceFilterResult).toEqual({ affected: 0, total: 2 })
})

test('a deleted dependency and a modified config file are detected', async () => {
  const { fs, stderr } = await runInlineTests(
    { ...files, 'vitest.config.js': { test: recorded } },
    recorded,
  )
  expect(stderr).toBe('')

  rmSync(fs.resolveFile('src/other.js'))
  const deleted = await runVitest({ root: fs.root, ...recorded, changed: true })
  expect(deleted.errorTree()).toMatchInlineSnapshot(`
    {
      "b.test.js": {
        "__module_errors__": [
          "Cannot find module './src/other.js' imported from <root>/b.test.js",
        ],
      },
    }
  `)

  fs.editFile('vitest.config.js', (content) => `${content}\n`)
  const configChanged = await runVitest({ root: fs.root, ...recorded, changed: true })
  expect(Object.keys(configChanged.testTree()).sort()).toEqual(['a.test.js', 'b.test.js'])
})

test('a test file without a record runs', async () => {
  const { fs, stderr } = await runInlineTests(files, recorded)
  expect(stderr).toBe('')

  fs.createFile('c.test.js', testFile('c'))
  const changed = await runVitest({ root: fs.root, ...recorded, changed: true })
  expect(changed.stderr).toBe('')
  expect(Object.keys(changed.testTree())).toEqual(['c.test.js'])
})

test('every test runs without recorded dependencies', async () => {
  const { testTree, stderr } = await runInlineTests(files, {
    cache: true,
    experimental: { vcsProvider: 'mtime' },
    changed: true,
  })
  expect(stderr).toBe('')
  expect(Object.keys(testTree()).sort()).toEqual(['a.test.js', 'b.test.js'])
})

test('a custom provider receives the dependencies of the test files', async () => {
  const { fs, stderr } = await runInlineTests(
    {
      ...files,
      'vitest.config.js': `
        import { writeFileSync } from 'node:fs'
        import { relative, sep } from 'node:path'
        export default {
          test: {
            cache: true,
            experimental: {
              recordDependencies: true,
              vcsProvider: {
                async findChangedFiles({ root, resolver }) {
                  const dependencies = await resolver.getDependencies()
                  const files = dependencies
                    .map(({ file, recordedAt }) => [relative(root, file).split(sep).join('/'), typeof recordedAt])
                    .filter(([file]) => !file.startsWith('..'))
                    .sort()
                  writeFileSync(new URL('./dependencies.json', import.meta.url), JSON.stringify(files))
                  return []
                },
              },
            },
          },
        }
      `,
    },
    { cache: true },
  )
  expect(stderr).toBe('')

  const changed = await runVitest({ root: fs.root, cache: true, changed: true })
  expect(changed.stderr).toBe('')
  expect(changed.ctx!._sourceFilterResult).toEqual({ affected: 0, total: 2 })
  expect(JSON.parse(readFileSync(fs.resolveFile('dependencies.json'), 'utf-8')))
    .toMatchInlineSnapshot(`
      [
        [
          "a.test.js",
          "number",
        ],
        [
          "b.test.js",
          "number",
        ],
        [
          "src/helper.js",
          "number",
        ],
        [
          "src/other.js",
          "number",
        ],
        [
          "vitest.config.js",
          "number",
        ],
      ]
    `)
})

test('coverage of changed files uses the dependencies of the run', async () => {
  const coverage = { enabled: true, provider: 'v8', reporter: ['json'], changed: true } as const
  const { fs, stderr } = await runInlineTests(files, recorded)
  expect(stderr).toBe('')

  fs.editFile('src/helper.js', () => 'export const helper = 1')
  const changed = await runVitest({ root: fs.root, ...recorded, coverage })
  expect(changed.stderr).toBe('')
  const report = JSON.parse(readFileSync(fs.resolveFile('coverage/coverage-final.json'), 'utf-8'))
  expect(Object.keys(report).map((file) => relative(fs.root, file))).toEqual(['src/helper.js'])
})

test('--stale records the dependencies and runs the stale tests', async () => {
  // the first run has no records, so every test runs
  const { fs, stderr, testTree } = await runInlineTests(files, { cache: true, stale: true })
  expect(stderr).toBe('')
  expect(Object.keys(testTree()).sort()).toEqual(['a.test.js', 'b.test.js'])

  fs.editFile('src/other.js', () => 'export const other = 1')
  const stale = await runVitest({ root: fs.root, cache: true, stale: true })
  expect(stale.stderr).toBe('')
  expect(Object.keys(stale.testTree())).toEqual(['b.test.js'])

  const fresh = await runVitest({ root: fs.root, cache: true, stale: true })
  expect(fresh.stderr).toBe('')
  expect(fresh.ctx!._sourceFilterResult).toEqual({ affected: 0, total: 2 })
})

test('--stale requires the cache', async () => {
  const { stderr } = await runInlineTests(files, { cache: false, stale: true })
  expect(stderr.split('\n')[0]).toMatchInlineSnapshot(
    `"Error: The "stale" option requires the "cache" option to store the dependencies of the test files."`,
  )
})

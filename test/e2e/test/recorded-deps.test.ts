import type { Vitest } from 'vitest/node'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'pathe'
import { describe, expect, test } from 'vitest'
import { runInlineTests, runVitest } from '../../test-utils'

const config = { cache: true, experimental: { recordDependencies: true } }

function testFile(name: string, imports = '') {
  return `
    ${imports}
    import { test } from 'vitest'
    test('${name}', () => {})
  `
}

function getDependenciesPath(ctx: Vitest | undefined) {
  return resolve(ctx!.viteConfig.cacheDir, 'dependencies.json')
}

// the files every test file loaded, sorted; the workspace `vitest` package is outside of the root
function readDependencies(ctx: Vitest | undefined) {
  const { projects } = JSON.parse(readFileSync(getDependenciesPath(ctx), 'utf-8'))
  const result: Record<string, Record<string, string[]>> = {}
  for (const name in projects) {
    const { modules, files, globalSetup, config } = projects[name]
    const project: Record<string, string[]> = (result[name] = {})
    const toFiles = (indices: number[]) =>
      indices
        .map((index: number) => modules[index])
        .filter((file: string) => !file.startsWith('../'))
        .sort()
    if (config.deps.length) {
      project['<config>'] = toFiles(config.deps)
    }
    if (globalSetup) {
      project['<globalSetup>'] = toFiles(globalSetup.deps)
    }
    for (const file in files) {
      project[file] = toFiles(files[file].deps)
    }
  }
  return result
}

test('only the tests that loaded a changed file run', async () => {
  const { ctx, fs, stderr } = await runInlineTests(
    {
      'src/helper.js': 'export const helper = 1',
      'src/other.js': 'export const other = 1',
      'a.test.js': testFile('a', `import './src/helper.js'`),
      'b.test.js': testFile('b', `import './src/other.js'`),
      'c.test.js': `
        import { test } from 'vitest'
        test('c', async () => {
          await import('./src/helper.js')
        })
      `,
    },
    config,
  )
  expect(stderr).toBe('')
  expect(readDependencies(ctx)).toMatchInlineSnapshot(`
    {
      "": {
        "<config>": [
          "vitest.config.js",
        ],
        "a.test.js": [
          "a.test.js",
          "src/helper.js",
        ],
        "b.test.js": [
          "b.test.js",
          "src/other.js",
        ],
        "c.test.js": [
          "c.test.js",
          "src/helper.js",
        ],
      },
    }
  `)

  fs.createFile('d.test.js', testFile('d'))
  const changed = await runVitest({ root: fs.root, ...config, related: ['src/helper.js'] })

  expect(changed.stderr).toBe('')
  // "d" has no record, so it runs
  expect(changed.testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "passed",
      },
      "c.test.js": {
        "c": "passed",
      },
      "d.test.js": {
        "d": "passed",
      },
    }
  `)
})

test.for([
  { pool: 'vmForks', isolate: true },
  { pool: 'forks', isolate: false },
])('a shared module graph records every test file ($pool, isolate: $isolate)', async (options) => {
  const { ctx, fs, stderr } = await runInlineTests(
    {
      'src/shared.js': `import './inner.js'`,
      'src/inner.js': 'export const inner = 1',
      'a.test.js': testFile('a', `import './src/shared.js'`),
      'b.test.js': testFile('b', `import './src/shared.js'`),
      'c.test.js': testFile('c'),
    },
    { ...config, ...options, fileParallelism: false },
  )
  expect(stderr).toBe('')
  expect(readDependencies(ctx)).toMatchInlineSnapshot(`
    {
      "": {
        "<config>": [
          "vitest.config.js",
        ],
        "a.test.js": [
          "a.test.js",
          "src/inner.js",
          "src/shared.js",
        ],
        "b.test.js": [
          "b.test.js",
          "src/inner.js",
          "src/shared.js",
        ],
        "c.test.js": [
          "c.test.js",
        ],
      },
    }
  `)

  const changed = await runVitest({ root: fs.root, ...config, related: ['src/inner.js'] })

  expect(changed.stderr).toBe('')
  expect(Object.keys(changed.testTree()).sort()).toEqual(['a.test.js', 'b.test.js'])
})

test('a mocked module does not load its own imports', async () => {
  const { ctx, fs, stderr } = await runInlineTests(
    {
      'src/dep.js': `
        import './inner.js'
        export const dep = 1
      `,
      'src/inner.js': 'export const inner = 1',
      'a.test.js': `
        import { test, vi } from 'vitest'
        import './src/dep.js'
        vi.mock('./src/dep.js', () => ({ dep: 2 }))
        test('a', () => {})
      `,
      'b.test.js': testFile('b', `import './src/dep.js'`),
    },
    config,
  )
  expect(stderr).toBe('')
  expect(readDependencies(ctx)).toMatchInlineSnapshot(`
    {
      "": {
        "<config>": [
          "vitest.config.js",
        ],
        "a.test.js": [
          "a.test.js",
          "src/dep.js",
        ],
        "b.test.js": [
          "b.test.js",
          "src/dep.js",
          "src/inner.js",
        ],
      },
    }
  `)

  const changed = await runVitest({ root: fs.root, ...config, related: ['src/inner.js'] })

  expect(changed.stderr).toBe('')
  expect(changed.testTree()).toMatchInlineSnapshot(`
    {
      "b.test.js": {
        "b": "passed",
      },
    }
  `)
})

test('a file loaded by a setup file or a global setup runs every test', async () => {
  const { ctx, fs, stderr } = await runInlineTests(
    {
      'vitest.config.js': {
        test: { ...config, setupFiles: ['./setup.js'], globalSetup: ['./global-setup.js'] },
      },
      'setup.js': `import './src/setup-helper.js'`,
      'src/setup-helper.js': 'export {}',
      'global-setup.js': `
        import './src/global-helper.js'
        export default () => {}
      `,
      'src/global-helper.js': 'export {}',
      'a.test.js': testFile('a'),
      'b.test.js': testFile('b'),
    },
    config,
  )
  expect(stderr).toBe('')
  expect(readDependencies(ctx)).toMatchInlineSnapshot(`
    {
      "": {
        "<config>": [
          "vitest.config.js",
        ],
        "<globalSetup>": [
          "global-setup.js",
          "src/global-helper.js",
        ],
        "a.test.js": [
          "a.test.js",
          "setup.js",
          "src/setup-helper.js",
        ],
        "b.test.js": [
          "b.test.js",
          "setup.js",
          "src/setup-helper.js",
        ],
      },
    }
  `)

  const setupChanged = await runVitest({
    root: fs.root,
    ...config,
    related: ['src/setup-helper.js'],
  })
  expect(setupChanged.stderr).toBe('')
  expect(Object.keys(setupChanged.testTree()).sort()).toEqual(['a.test.js', 'b.test.js'])

  const globalSetupChanged = await runVitest({
    root: fs.root,
    ...config,
    related: ['src/global-helper.js'],
  })
  expect(globalSetupChanged.stderr).toBe('')
  expect(Object.keys(globalSetupChanged.testTree()).sort()).toEqual(['a.test.js', 'b.test.js'])

  const unrelated = await runVitest({ root: fs.root, ...config, related: ['src/none.js'] })
  expect(unrelated.stderr).toMatchInlineSnapshot(`
    "No affected test files found, exiting with code 1

    "
  `)
  expect(unrelated.testTree()).toMatchInlineSnapshot(`{}`)
})

test('a partial run keeps the modules of the previous complete run', async () => {
  const { ctx, fs, stderr } = await runInlineTests(
    {
      'src/first.js': 'export const first = 1',
      'src/second.js': 'export const second = 1',
      'a.test.js': `
        import { test } from 'vitest'
        test('first', async () => {
          await import('./src/first.js')
        })
        test('second', async () => {
          await import('./src/second.js')
        })
      `,
    },
    config,
  )
  expect(stderr).toBe('')
  expect(readDependencies(ctx)['']['a.test.js']).toEqual([
    'a.test.js',
    'src/first.js',
    'src/second.js',
  ])

  const partial = await runVitest({ root: fs.root, ...config, testNamePattern: 'first' })
  expect(partial.stderr).toBe('')
  expect(readDependencies(partial.ctx)['']['a.test.js']).toEqual([
    'a.test.js',
    'src/first.js',
    'src/second.js',
  ])
})

test('a partial run without a previous record does not create one', async () => {
  const { ctx, fs, stderr } = await runInlineTests(
    {
      'src/dynamic.js': 'export {}',
      'a.test.js': `
        import { test } from 'vitest'
        test('static', () => {})
        test('dynamic', async () => {
          await import('./src/dynamic.js')
        })
      `,
      'b.test.js': testFile('b'),
    },
    { ...config, testNamePattern: 'static' },
  )
  expect(stderr).toBe('')
  expect(readDependencies(ctx)).toMatchInlineSnapshot(`
    {
      "": {},
    }
  `)

  // files without a record always run, and the complete run records them
  const first = await runVitest({ root: fs.root, ...config, related: ['src/dynamic.js'] })
  expect(first.stderr).toBe('')
  expect(first.testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "dynamic": "passed",
        "static": "passed",
      },
      "b.test.js": {
        "b": "passed",
      },
    }
  `)
  expect(readDependencies(first.ctx)).toMatchInlineSnapshot(`
    {
      "": {
        "a.test.js": [
          "a.test.js",
          "src/dynamic.js",
        ],
        "b.test.js": [
          "b.test.js",
        ],
      },
    }
  `)

  const second = await runVitest({ root: fs.root, ...config, related: ['src/dynamic.js'] })
  expect(second.stderr).toBe('')
  expect(Object.keys(second.testTree())).toEqual(['a.test.js'])
})

test('a mock loaded from a file is recorded', async () => {
  const { ctx, fs, stderr } = await runInlineTests(
    {
      'src/dep.js': `
        import './inner.js'
        export const dep = 1
      `,
      'src/inner.js': 'export const inner = 1',
      'src/__mocks__/dep.js': 'export const dep = 2',
      'src/dep.mock.js': 'export const dep = 3',
      'automock.test.js': `
        import { test, vi } from 'vitest'
        import './src/dep.js'
        vi.mock('./src/dep.js')
        test('automock', () => {})
      `,
      'factory.test.js': `
        import { test, vi } from 'vitest'
        import './src/dep.js'
        vi.mock('./src/dep.js', () => import('./src/dep.mock.js'))
        test('factory', () => {})
      `,
      'original.test.js': `
        import { test, vi } from 'vitest'
        import './src/dep.js'
        vi.mock('./src/dep.js', async (importOriginal) => ({ ...(await importOriginal()), dep: 4 }))
        test('original', () => {})
      `,
    },
    config,
  )
  expect(stderr).toBe('')
  expect(readDependencies(ctx)).toMatchInlineSnapshot(`
    {
      "": {
        "<config>": [
          "vitest.config.js",
        ],
        "automock.test.js": [
          "automock.test.js",
          "src/__mocks__/dep.js",
          "src/dep.js",
        ],
        "factory.test.js": [
          "factory.test.js",
          "src/dep.js",
          "src/dep.mock.js",
        ],
        "original.test.js": [
          "original.test.js",
          "src/dep.js",
          "src/inner.js",
        ],
      },
    }
  `)

  const mockChanged = await runVitest({
    root: fs.root,
    ...config,
    related: ['src/__mocks__/dep.js', 'src/dep.mock.js'],
  })
  expect(mockChanged.stderr).toBe('')
  expect(Object.keys(mockChanged.testTree()).sort()).toEqual([
    'automock.test.js',
    'factory.test.js',
  ])

  const innerChanged = await runVitest({ root: fs.root, ...config, related: ['src/inner.js'] })
  expect(innerChanged.stderr).toBe('')
  expect(Object.keys(innerChanged.testTree())).toEqual(['original.test.js'])
})

test('a file imported with a query and a file added by a plugin are recorded', async () => {
  const { ctx, fs, stderr } = await runInlineTests(
    {
      'vitest.config.js': `
        import { readFileSync } from 'node:fs'
        export default {
          plugins: [{
            name: 'template',
            load(id) {
              if (id.endsWith('/src/template.js')) {
                const html = id.replace(/\\.js$/, '.html')
                this.addWatchFile(html)
                return \`export default \${JSON.stringify(readFileSync(html, 'utf-8'))}\`
              }
            },
          }],
          test: ${JSON.stringify(config)},
        }
      `,
      'src/data.txt': 'data',
      'src/template.html': '<div></div>',
      'src/template.js': 'export default ""',
      'raw.test.js': testFile('raw', `import './src/data.txt?raw'`),
      'template.test.js': testFile('template', `import './src/template.js'`),
    },
    config,
  )
  expect(stderr).toBe('')
  expect(readDependencies(ctx)).toMatchInlineSnapshot(`
    {
      "": {
        "<config>": [
          "vitest.config.js",
        ],
        "raw.test.js": [
          "raw.test.js",
          "src/data.txt",
        ],
        "template.test.js": [
          "src/template.html",
          "src/template.js",
          "template.test.js",
        ],
      },
    }
  `)

  const changed = await runVitest({
    root: fs.root,
    ...config,
    related: ['src/data.txt', 'src/template.html'],
  })
  expect(changed.stderr).toBe('')
  expect(Object.keys(changed.testTree()).sort()).toEqual(['raw.test.js', 'template.test.js'])
})

test.for([{ pool: 'forks' }, { pool: 'vmForks' }])(
  'a file loaded by a custom environment runs every test ($pool)',
  async ({ pool }) => {
    const { ctx, fs, stderr } = await runInlineTests(
      {
        'environment.js': `
        import { builtinEnvironments } from 'vitest/runtime'
        import './src/environment-helper.js'
        export default {
          name: 'custom',
          viteEnvironment: 'ssr',
          setup() {
            return { teardown() {} }
          },
          setupVM: (options) => builtinEnvironments.node.setupVM(options),
        }
      `,
        'src/environment-helper.js': 'export {}',
        'a.test.js': testFile('a'),
        'b.test.js': testFile('b'),
      },
      { ...config, pool, environment: './environment.js' },
    )
    expect(stderr).toBe('')
    expect(readDependencies(ctx)).toMatchInlineSnapshot(`
      {
        "": {
          "<config>": [
            "vitest.config.js",
          ],
          "a.test.js": [
            "a.test.js",
            "environment.js",
            "src/environment-helper.js",
          ],
          "b.test.js": [
            "b.test.js",
            "environment.js",
            "src/environment-helper.js",
          ],
        },
      }
    `)

    const changed = await runVitest({
      root: fs.root,
      ...config,
      pool,
      environment: './environment.js',
      related: ['src/environment-helper.js'],
    })
    expect(changed.stderr).toBe('')
    expect(Object.keys(changed.testTree()).sort()).toEqual(['a.test.js', 'b.test.js'])
  },
)

test('a file loaded by a custom runner runs every test', async () => {
  const { ctx, fs, stderr } = await runInlineTests(
    {
      'runner.js': `
        import './src/runner-helper.js'
        export { TestRunner as default } from 'vitest'
      `,
      'src/runner-helper.js': 'export {}',
      'a.test.js': testFile('a'),
      'b.test.js': testFile('b'),
    },
    { ...config, runner: './runner.js' },
  )
  expect(stderr).toBe('')
  expect(readDependencies(ctx)).toMatchInlineSnapshot(`
    {
      "": {
        "<config>": [
          "vitest.config.js",
        ],
        "a.test.js": [
          "a.test.js",
          "runner.js",
          "src/runner-helper.js",
        ],
        "b.test.js": [
          "b.test.js",
          "runner.js",
          "src/runner-helper.js",
        ],
      },
    }
  `)

  const changed = await runVitest({
    root: fs.root,
    ...config,
    runner: './runner.js',
    related: ['src/runner-helper.js'],
  })
  expect(changed.stderr).toBe('')
  expect(Object.keys(changed.testTree()).sort()).toEqual(['a.test.js', 'b.test.js'])
})

test.for(['vitest.config.js', '.env'])('a change in %s runs every test', async (file) => {
  const { fs, stderr } = await runInlineTests(
    {
      'vitest.config.js': { test: config },
      'a.test.js': testFile('a'),
      'b.test.js': testFile('b'),
    },
    config,
  )
  expect(stderr).toBe('')

  const changed = await runVitest({ root: fs.root, ...config, related: [file] })
  expect(changed.stderr).toBe('')
  expect(Object.keys(changed.testTree()).sort()).toEqual(['a.test.js', 'b.test.js'])
})

test('snapshot files are recorded for the tests that use them', async () => {
  const { ctx, fs, stderr } = await runInlineTests(
    {
      '__snapshots__/snap.test.js.snap': `
// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

exports[\`snap 1\`] = \`1\`;
`,
      'fixtures/file.txt': 'content',
      'snap.test.js': `
        import { expect, test } from 'vitest'
        test('snap', () => {
          expect(1).toMatchSnapshot()
        })
      `,
      'file.test.js': `
        import { expect, test } from 'vitest'
        test('file', async () => {
          await expect('content').toMatchFileSnapshot('./fixtures/file.txt')
        })
      `,
      'plain.test.js': testFile('plain'),
    },
    config,
  )
  expect(stderr).toBe('')
  expect(readDependencies(ctx)).toMatchInlineSnapshot(`
    {
      "": {
        "<config>": [
          "vitest.config.js",
        ],
        "file.test.js": [
          "file.test.js",
          "fixtures/file.txt",
        ],
        "plain.test.js": [
          "plain.test.js",
        ],
        "snap.test.js": [
          "__snapshots__/snap.test.js.snap",
          "snap.test.js",
        ],
      },
    }
  `)

  const snapshotChanged = await runVitest({
    root: fs.root,
    ...config,
    related: ['__snapshots__/snap.test.js.snap'],
  })
  expect(snapshotChanged.stderr).toBe('')
  expect(Object.keys(snapshotChanged.testTree())).toEqual(['snap.test.js'])

  const fileChanged = await runVitest({ root: fs.root, ...config, related: ['fixtures/file.txt'] })
  expect(fileChanged.stderr).toBe('')
  expect(Object.keys(fileChanged.testTree())).toEqual(['file.test.js'])
})

test('records are kept per project', async () => {
  const { ctx, fs, stderr } = await runInlineTests(
    {
      'vitest.config.js': {
        test: {
          ...config,
          projects: [
            { test: { name: 'first', include: ['first/*.test.js'] } },
            { test: { name: 'second', include: ['second/*.test.js'] } },
          ],
        },
      },
      'src/shared.js': 'export {}',
      'first/a.test.js': testFile('a', `import '../src/shared.js'`),
      'second/b.test.js': testFile('b'),
    },
    config,
  )
  expect(stderr).toBe('')
  expect(readDependencies(ctx)).toMatchInlineSnapshot(`
    {
      "": {
        "<config>": [
          "vitest.config.js",
        ],
      },
      "first": {
        "<config>": [
          "vitest.config.js",
        ],
        "first/a.test.js": [
          "first/a.test.js",
          "src/shared.js",
        ],
      },
      "second": {
        "<config>": [
          "vitest.config.js",
        ],
        "second/b.test.js": [
          "second/b.test.js",
        ],
      },
    }
  `)

  const changed = await runVitest({ root: fs.root, ...config, related: ['src/shared.js'] })
  expect(changed.stderr).toBe('')
  expect(Object.keys(changed.testTree())).toEqual(['first/a.test.js'])
})

test('a file that fails to load records the modules loaded before the error', async () => {
  const { ctx, fs, errorTree } = await runInlineTests(
    {
      'src/broken.js': `throw new Error('broken')`,
      'src/other.js': 'export {}',
      'a.test.js': testFile('a', `import './src/broken.js'`),
      'b.test.js': testFile('b', `import './src/other.js'`),
    },
    config,
  )
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "__module_errors__": [
          "broken",
        ],
      },
      "b.test.js": {
        "b": "passed",
      },
    }
  `)
  expect(readDependencies(ctx)['']['a.test.js']).toEqual(['a.test.js', 'src/broken.js'])

  fs.editFile('src/broken.js', () => 'export {}')
  const fixed = await runVitest({ root: fs.root, ...config, related: ['src/broken.js'] })
  expect(fixed.stderr).toBe('')
  expect(fixed.testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "passed",
      },
    }
  `)
})

test('a deleted dependency runs the tests that loaded it', async () => {
  const { fs, stderr } = await runInlineTests(
    {
      'src/helper.js': 'export {}',
      'a.test.js': testFile('a', `import './src/helper.js'`),
      'b.test.js': testFile('b'),
    },
    config,
  )
  expect(stderr).toBe('')

  rmSync(fs.resolveFile('src/helper.js'))
  const changed = await runVitest({ root: fs.root, ...config, related: ['src/helper.js'] })
  expect(changed.errorTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "__module_errors__": [
          "Cannot find module './src/helper.js' imported from <root>/a.test.js",
        ],
      },
    }
  `)
})

test('a complete run replaces the record of the file and keeps the others', async () => {
  const { ctx, fs, stderr } = await runInlineTests(
    {
      'src/helper.js': 'export {}',
      'src/other.js': 'export {}',
      'a.test.js': testFile('a', `import './src/helper.js'`),
      'b.test.js': testFile('b', `import './src/helper.js'`),
    },
    config,
  )
  expect(stderr).toBe('')
  expect(readDependencies(ctx)['']['a.test.js']).toEqual(['a.test.js', 'src/helper.js'])

  fs.editFile('a.test.js', (content) => content.replace('src/helper.js', 'src/other.js'))
  const filtered = await runVitest({ root: fs.root, ...config, $cliFilters: ['a.test.js'] })
  expect(filtered.stderr).toBe('')
  expect(readDependencies(filtered.ctx)).toMatchInlineSnapshot(`
    {
      "": {
        "<config>": [
          "vitest.config.js",
        ],
        "a.test.js": [
          "a.test.js",
          "src/other.js",
        ],
        "b.test.js": [
          "b.test.js",
          "src/helper.js",
        ],
      },
    }
  `)

  const changed = await runVitest({ root: fs.root, ...config, related: ['src/helper.js'] })
  expect(changed.stderr).toBe('')
  expect(Object.keys(changed.testTree())).toEqual(['b.test.js'])
})

test('nothing is recorded when the option is disabled', async () => {
  const { ctx, stderr } = await runInlineTests({ 'a.test.js': testFile('a') }, { cache: true })
  expect(stderr).toBe('')
  expect(existsSync(getDependenciesPath(ctx))).toBe(false)
})

test('every test runs when the cache is disabled', async () => {
  const { ctx, fs, stderr } = await runInlineTests(
    {
      'src/helper.js': 'export {}',
      'a.test.js': testFile('a', `import './src/helper.js'`),
      'b.test.js': testFile('b'),
    },
    { ...config, cache: false },
  )
  expect(stderr).toBe('')
  expect(existsSync(getDependenciesPath(ctx))).toBe(false)

  const changed = await runVitest({
    root: fs.root,
    ...config,
    cache: false,
    related: ['src/helper.js'],
  })
  expect(changed.stderr).toBe('')
  expect(Object.keys(changed.testTree()).sort()).toEqual(['a.test.js', 'b.test.js'])
})

test('clearing the cache removes the records', async () => {
  const { ctx, stderr } = await runInlineTests(
    { 'a.test.js': testFile('a') },
    // the shared fs module cache is used by the other tests in parallel
    { ...config, fsModuleCachePath: './node_modules/.vitest-fs-cache' },
  )
  expect(stderr).toBe('')
  const path = getDependenciesPath(ctx)
  expect(existsSync(path)).toBe(true)

  await ctx!.clearCache()
  expect(existsSync(path)).toBe(false)
})

test('a run of the affected tests keeps the records of the other tests', async () => {
  const { ctx, fs, stderr } = await runInlineTests(
    {
      'src/helper.js': 'export {}',
      'src/other.js': 'export {}',
      'a.test.js': testFile('a', `import './src/helper.js'`),
      'b.test.js': testFile('b', `import './src/other.js'`),
    },
    config,
  )
  expect(stderr).toBe('')
  const before = readDependencies(ctx)

  const changed = await runVitest({ root: fs.root, ...config, related: ['src/helper.js'] })
  expect(changed.stderr).toBe('')
  expect(Object.keys(changed.testTree())).toEqual(['a.test.js'])
  expect(readDependencies(changed.ctx)).toEqual(before)

  const other = await runVitest({ root: fs.root, ...config, related: ['src/other.js'] })
  expect(other.stderr).toBe('')
  expect(Object.keys(other.testTree())).toEqual(['b.test.js'])
})

test('a rerun of one file in watch mode keeps the records of the other files', async () => {
  const { ctx, fs, stderr, vitest } = await runInlineTests(
    {
      'src/helper.js': 'export {}',
      'src/other.js': 'export {}',
      'a.test.js': testFile('a', `import './src/helper.js'`),
      'b.test.js': testFile('b', `import './src/other.js'`),
    },
    { ...config, watch: true },
  )
  expect(stderr).toBe('')
  await vitest.waitForStdout('Waiting for file changes')
  vitest.resetOutput()

  fs.editFile('a.test.js', (content) => content.replace('src/helper.js', 'src/other.js'))
  await vitest.waitForStdout('RERUN')
  await vitest.waitForStdout('Waiting for file changes')

  expect(readDependencies(ctx)).toMatchInlineSnapshot(`
    {
      "": {
        "<config>": [
          "vitest.config.js",
        ],
        "a.test.js": [
          "a.test.js",
          "src/other.js",
        ],
        "b.test.js": [
          "b.test.js",
          "src/other.js",
        ],
      },
    }
  `)
})

test('a file that did not run because of bail keeps its record', async () => {
  const { ctx, fs } = await runInlineTests(
    {
      'src/helper.js': 'export {}',
      'a.test.js': `
        import { expect, test } from 'vitest'
        test('a', () => {
          expect(1).toBe(2)
        })
      `,
      'b.test.js': testFile('b', `import './src/helper.js'`),
    },
    config,
  )
  const before = readDependencies(ctx)
  expect(before['']['b.test.js']).toEqual(['b.test.js', 'src/helper.js'])

  // the failed file runs first, so "b" never starts
  fs.editFile('b.test.js', (content) => content.replace(`import './src/helper.js'`, ''))
  const bailed = await runVitest({ root: fs.root, ...config, bail: 1, fileParallelism: false })
  expect(bailed.testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "failed",
      },
      "b.test.js": {},
    }
  `)
  expect(readDependencies(bailed.ctx)).toEqual(before)
})

describe('without the module runner', () => {
  const native = { ...config, experimental: { ...config.experimental, viteModuleRunner: false } }

  test('only the tests that loaded a changed file run', async () => {
    const { ctx, fs, stderr } = await runInlineTests(
      {
        'src/helper.js': `import './inner.js'`,
        'src/inner.js': 'export {}',
        'src/other.js': 'export {}',
        'a.test.js': testFile('a', `import './src/helper.js'`),
        'b.test.js': testFile('b', `import './src/other.js'`),
      },
      native,
    )
    expect(stderr).toBe('')
    expect(readDependencies(ctx)).toMatchInlineSnapshot(`
      {
        "": {
          "a.test.js": [
            "a.test.js",
            "src/helper.js",
            "src/inner.js",
          ],
          "b.test.js": [
            "b.test.js",
            "src/other.js",
          ],
        },
      }
    `)

    const changed = await runVitest({ root: fs.root, ...native, related: ['src/inner.js'] })
    expect(changed.stderr).toBe('')
    expect(Object.keys(changed.testTree())).toEqual(['a.test.js'])
  })

  test('a module loaded by a previous file in the same worker is recorded', async () => {
    const { ctx, fs, stderr } = await runInlineTests(
      {
        'src/shared.js': `import './inner.js'`,
        'src/inner.js': 'export const inner = 1',
        'a.test.js': testFile('a', `import './src/shared.js'`),
        'b.test.js': testFile('b', `import './src/shared.js'`),
        'c.test.js': testFile('c'),
      },
      { ...native, isolate: false, fileParallelism: false },
    )
    expect(stderr).toBe('')
    expect(readDependencies(ctx)).toMatchInlineSnapshot(`
      {
        "": {
          "a.test.js": [
            "a.test.js",
            "src/inner.js",
            "src/shared.js",
          ],
          "b.test.js": [
            "b.test.js",
            "src/inner.js",
            "src/shared.js",
          ],
          "c.test.js": [
            "c.test.js",
          ],
        },
      }
    `)

    const changed = await runVitest({ root: fs.root, ...native, related: ['src/inner.js'] })
    expect(changed.stderr).toBe('')
    expect(Object.keys(changed.testTree()).sort()).toEqual(['a.test.js', 'b.test.js'])
  })

  test('a file loaded by a setup file, a global setup or an environment runs every test', async () => {
    const { ctx, fs, stderr } = await runInlineTests(
      {
        'vitest.config.js': {
          test: {
            ...native,
            setupFiles: ['./setup.js'],
            globalSetup: ['./global-setup.js'],
            environment: './environment.js',
          },
        },
        'setup.js': `import './src/setup-helper.js'`,
        'src/setup-helper.js': 'export {}',
        'global-setup.js': `
          import './src/global-helper.js'
          export default () => {}
        `,
        'src/global-helper.js': 'export {}',
        'environment.js': `
          import './src/environment-helper.js'
          export default {
            name: 'custom',
            viteEnvironment: 'ssr',
            setup() {
              return { teardown() {} }
            },
          }
        `,
        'src/environment-helper.js': 'export {}',
        'a.test.js': testFile('a'),
        'b.test.js': testFile('b'),
      },
      native,
    )
    expect(stderr).toBe('')
    expect(readDependencies(ctx)).toMatchInlineSnapshot(`
      {
        "": {
          "<globalSetup>": [
            "global-setup.js",
            "src/global-helper.js",
          ],
          "a.test.js": [
            "a.test.js",
            "environment.js",
            "setup.js",
            "src/environment-helper.js",
            "src/setup-helper.js",
          ],
          "b.test.js": [
            "b.test.js",
            "environment.js",
            "setup.js",
            "src/environment-helper.js",
            "src/setup-helper.js",
          ],
        },
      }
    `)

    for (const file of [
      'src/setup-helper.js',
      'src/global-helper.js',
      'src/environment-helper.js',
    ]) {
      const changed = await runVitest({ root: fs.root, related: [file] })
      expect(changed.stderr).toBe('')
      expect(Object.keys(changed.testTree()).sort()).toEqual(['a.test.js', 'b.test.js'])
    }
  })

  test('a mocked module does not load its own imports', async () => {
    const { ctx, fs, stderr } = await runInlineTests(
      {
        'src/dep.js': `
          import './inner.js'
          export const dep = 1
        `,
        'src/inner.js': 'export const inner = 1',
        'src/__mocks__/dep.js': 'export const dep = 2',
        'factory.test.js': `
          import { test, vi } from 'vitest'
          import './src/dep.js'
          vi.mock('./src/dep.js', () => ({ dep: 2 }))
          test('factory', () => {})
        `,
        'automock.test.js': `
          import { test, vi } from 'vitest'
          import './src/dep.js'
          vi.mock('./src/dep.js')
          test('automock', () => {})
        `,
        'plain.test.js': testFile('plain', `import './src/dep.js'`),
      },
      native,
    )
    expect(stderr).toBe('')
    expect(readDependencies(ctx)).toMatchInlineSnapshot(`
      {
        "": {
          "automock.test.js": [
            "automock.test.js",
            "src/__mocks__/dep.js",
            "src/dep.js",
          ],
          "factory.test.js": [
            "factory.test.js",
            "src/dep.js",
          ],
          "plain.test.js": [
            "plain.test.js",
            "src/dep.js",
            "src/inner.js",
          ],
        },
      }
    `)

    const changed = await runVitest({ root: fs.root, ...native, related: ['src/inner.js'] })
    expect(changed.stderr).toBe('')
    expect(Object.keys(changed.testTree())).toEqual(['plain.test.js'])

    const mockChanged = await runVitest({
      root: fs.root,
      ...native,
      related: ['src/__mocks__/dep.js'],
    })
    expect(mockChanged.stderr).toBe('')
    expect(Object.keys(mockChanged.testTree())).toEqual(['automock.test.js'])
  })
})

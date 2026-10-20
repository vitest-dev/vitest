import { expect, test } from 'vitest'
import { runInlineTests, runVitest, useFS } from '../../test-utils'

test("if file has import.meta.glob, it's not cached", async () => {
  const { createFile } = useFS(
    './fixtures/caching/import-meta-glob/generated',
    {
      1: '1',
      2: '2',
    },
    false,
  )

  const { errorTree: errorTree1 } = await runVitest({
    root: './fixtures/caching/import-meta-glob',
    provide: {
      generated: ['./generated/1', './generated/2'],
    },
    fsModuleCache: true,
    fsModuleCachePath: './node_modules/.vitest-fs-cache',
  })

  expect(errorTree1()).toMatchInlineSnapshot(`
    {
      "glob.test.js": {
        "replaced variable is the same": "passed",
      },
    }
  `)

  createFile('3', '3')

  const { errorTree: errorTree2 } = await runVitest({
    root: './fixtures/caching/import-meta-glob',
    provide: {
      generated: ['./generated/1', './generated/2', './generated/3'],
    },
    fsModuleCache: true,
    fsModuleCachePath: './node_modules/.vitest-fs-cache',
  })

  expect(errorTree2()).toMatchInlineSnapshot(`
    {
      "glob.test.js": {
        "replaced variable is the same": "passed",
      },
    }
  `)
})

test("if file has import.meta.glob with a type argument, it's not cached", async () => {
  const structure = {
    'src/a.js': 'export default 1',
    'src/b.js': 'export default 2',
    'glob.test.ts': /* ts */ `
      import { expect, inject, test } from 'vitest'

      const files = import.meta.glob<{ default: number }>('./src/*.js', { eager: true })

      test('glob', () => {
        expect(Object.keys(files)).toEqual(inject('files'))
      })
    `,
  }
  const config = {
    fsModuleCache: true,
    fsModuleCachePath: './node_modules/.vitest-fs-cache',
  }

  const cold = await runInlineTests(structure, {
    ...config,
    provide: { files: ['./src/a.js', './src/b.js'] },
  })

  expect(cold.stderr).toBe('')
  expect(cold.errorTree()).toMatchInlineSnapshot(`
    {
      "glob.test.ts": {
        "glob": "passed",
      },
    }
  `)
  await cold.ctx?.close()

  cold.fs.createFile('src/c.js', 'export default 3')

  const warm = await runVitest({
    root: cold.root,
    ...config,
    provide: { files: ['./src/a.js', './src/b.js', './src/c.js'] },
  })

  expect(warm.stderr).toBe('')
  expect(warm.errorTree()).toMatchInlineSnapshot(`
    {
      "glob.test.ts": {
        "glob": "passed",
      },
    }
  `)
})

test("if file has a dynamic import with a template literal, it's not cached", async () => {
  const structure = {
    'src/a.js': `export default 'a'`,
    'src/b.js': `export default 'b'`,
    'load.test.js': /* js */ `
      import { expect, inject, test } from 'vitest'

      const load = (name) => import(\`./src/\${name}.js\`)

      test('load', async () => {
        const names = inject('names')
        const modules = await Promise.all(names.map(load))
        expect(modules.map((m) => m.default)).toEqual(names)
      })
    `,
  }
  const config = {
    fsModuleCache: true,
    fsModuleCachePath: './node_modules/.vitest-fs-cache',
  }

  const cold = await runInlineTests(structure, {
    ...config,
    provide: { names: ['a', 'b'] },
  })

  expect(cold.stderr).toBe('')
  expect(cold.errorTree()).toMatchInlineSnapshot(`
    {
      "load.test.js": {
        "load": "passed",
      },
    }
  `)
  await cold.ctx?.close()

  cold.fs.createFile('src/c.js', `export default 'c'`)

  const warm = await runVitest({
    root: cold.root,
    ...config,
    provide: { names: ['a', 'b', 'c'] },
  })

  expect(warm.stderr).toBe('')
  expect(warm.errorTree()).toMatchInlineSnapshot(`
    {
      "load.test.js": {
        "load": "passed",
      },
    }
  `)
})

test("if file has new URL() with a template literal, it's not cached", async () => {
  const structure = {
    'assets/a.png': '',
    'assets/b.png': '',
    'client-env.js': /* js */ `
      export default {
        name: 'client-env',
        viteEnvironment: 'client',
        setup() {
          return { teardown() {} }
        },
      }
    `,
    'url.test.js': /* js */ `
      import { expect, inject, test } from 'vitest'

      const getUrl = (name) => new URL(\`./assets/\${name}.png\`, import.meta.url)

      test('url', () => {
        const names = inject('names')
        const files = names.map((name) => getUrl(name).pathname.split('/').pop())
        expect(files).toEqual(names.map((name) => \`\${name}.png\`))
      })
    `,
  }
  const config = {
    environment: './client-env.js',
    fsModuleCache: true,
    fsModuleCachePath: './node_modules/.vitest-fs-cache',
  }

  const cold = await runInlineTests(structure, {
    ...config,
    provide: { names: ['a', 'b'] },
  })

  expect(cold.stderr).toBe('')
  expect(cold.errorTree()).toMatchInlineSnapshot(`
    {
      "url.test.js": {
        "url": "passed",
      },
    }
  `)
  await cold.ctx?.close()

  cold.fs.createFile('assets/c.png', '')

  const warm = await runVitest({
    root: cold.root,
    ...config,
    provide: { names: ['a', 'b', 'c'] },
  })

  expect(warm.stderr).toBe('')
  expect(warm.errorTree()).toMatchInlineSnapshot(`
    {
      "url.test.js": {
        "url": "passed",
      },
    }
  `)
})

test('if no cache key generator is defined, the hash is invalid', async () => {
  process.env.REPLACED = 'value1'

  const { errorTree: errorTree1 } = await runVitest({
    root: './fixtures/caching/dynamic-cache-key',
    config: './vitest.config.fails.js',
    fsModuleCache: true,
    fsModuleCachePath: './node_modules/.vitest-fs-cache',
    reporters: [
      {
        async onInit(vitest) {
          // make sure cache is empty
          await vitest.clearCache()
        },
      },
    ],
  })

  expect(errorTree1()).toMatchInlineSnapshot(`
    {
      "replaced.test.js": {
        "replaced variable is the same": "passed",
      },
    }
  `)

  process.env.REPLACED = 'value2'

  const { errorTree: errorTree2 } = await runVitest({
    root: './fixtures/caching/dynamic-cache-key',
    config: './vitest.config.fails.js',
    fsModuleCache: true,
    fsModuleCachePath: './node_modules/.vitest-fs-cache',
  })

  expect(errorTree2()).toMatchInlineSnapshot(`
    {
      "replaced.test.js": {
        "replaced variable is the same": [
          "expected 'value1' to be 'value2' // Object.is equality",
        ],
      },
    }
  `)
})

test('if cache key generator is defined, the hash is valid', async () => {
  process.env.REPLACED = 'value1'

  const { errorTree: errorTree1 } = await runVitest({
    root: './fixtures/caching/dynamic-cache-key',
    config: './vitest.config.passes.js',
    fsModuleCache: true,
    fsModuleCachePath: './node_modules/.vitest-fs-cache',
    reporters: [
      {
        async onInit(vitest) {
          // make sure cache is empty
          await vitest.clearCache()
        },
      },
    ],
  })

  expect(errorTree1()).toMatchInlineSnapshot(`
    {
      "replaced.test.js": {
        "replaced variable is the same": "passed",
      },
    }
  `)

  process.env.REPLACED = 'value2'

  const { errorTree: errorTree2 } = await runVitest({
    root: './fixtures/caching/dynamic-cache-key',
    config: './vitest.config.passes.js',
    fsModuleCache: true,
    fsModuleCachePath: './node_modules/.vitest-fs-cache',
  })

  expect(errorTree2()).toMatchInlineSnapshot(`
    {
      "replaced.test.js": {
        "replaced variable is the same": "passed",
      },
    }
  `)
})

test.each([
  ['foo', 'bar'],
  ['bar', 'foo'],
])('cache key generators are scoped to projects (%s, %s)', async (first, second) => {
  const cold = await runInlineTests({
    'vitest.config.js': `
      import { defineConfig } from 'vitest/config'
      export default defineConfig({
        test: {
          fsModuleCache: true,
          fsModuleCachePath: './node_modules/.vitest-fs-cache',
          projects: ${JSON.stringify([first, second])}.map(name => ({
            plugins: [{
              name: 'replacer',
              configureVitest({ defineCacheKeyGenerator }) {
                defineCacheKeyGenerator(() => name)
              },
              transform(code, id) {
                if (id.endsWith('/common.js')) {
                  return code.replace('PLACEHOLDER', name)
                }
              },
            }],
            test: { name, include: [name + '.test.js'] },
          })),
        },
      })
    `,
    'common.js': `export const value = 'PLACEHOLDER'`,
    'foo.test.js': `
      import { expect, test } from 'vitest'
      import { value } from './common.js'
      test('project value', () => expect(value).toBe('foo'))
    `,
    'bar.test.js': `
      import { expect, test } from 'vitest'
      import { value } from './common.js'
      test('project value', () => expect(value).toBe('bar'))
    `,
  })
  const warm = await runVitest({ root: cold.root })
  for (const run of [cold, warm]) {
    expect(run.stderr).toBe('')
    expect(run.errorTree()).toMatchInlineSnapshot(`
      {
        "bar.test.js": {
          "project value": "passed",
        },
        "foo.test.js": {
          "project value": "passed",
        },
      }
    `)
  }
})

test('filtering by related sources reuses the cache', async () => {
  const transformed: string[] = []
  ;(globalThis as any).__vitest_transformed__ = transformed

  const cold = await runInlineTests(
    {
      'vitest.config.js': `
        import { defineConfig } from 'vitest/config'
        export default defineConfig({
          plugins: [{
            name: 'track-transforms',
            transform(_code, id) {
              if (id.startsWith(this.environment.config.root)) {
                globalThis.__vitest_transformed__.push(id.slice(this.environment.config.root.length + 1))
              }
            },
          }],
          test: {
            fsModuleCache: true,
            fsModuleCachePath: './node_modules/.vitest-fs-cache',
          },
        })
      `,
      'a.js': `export const a = 'a'`,
      'b.js': `export const b = 'b'`,
      'a.test.js': `
        import { expect, test } from 'vitest'
        import { a } from './a.js'
        test('a', () => expect(a).toBe('a'))
      `,
      'b.test.js': `
        import { expect, test } from 'vitest'
        import { b } from './b.js'
        test('b', () => expect(b).toBe('b'))
      `,
    },
    { related: ['a.js'] },
  )

  expect(cold.stderr).toBe('')
  expect(cold.testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "passed",
      },
    }
  `)
  expect(transformed.sort()).toMatchInlineSnapshot(`
    [
      "a.js",
      "a.test.js",
      "b.js",
      "b.test.js",
    ]
  `)

  transformed.length = 0

  const warm = await runVitest({ root: cold.root, related: ['a.js'] })

  expect(warm.stderr).toBe('')
  expect(warm.testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "passed",
      },
    }
  `)
  expect(transformed).toEqual([])

  delete (globalThis as any).__vitest_transformed__
})

test('filtering by related sources runs setup files before every non-isolated file', async () => {
  const testFile = `
    import { expect, test } from 'vitest'
    import './dep.js'

    const setupRuns = globalThis.setupRuns
    globalThis.testFiles = (globalThis.testFiles ?? 0) + 1

    test('setup file ran before this file', () => {
      expect(setupRuns).toBe(globalThis.testFiles)
    })
  `
  const related = await runInlineTests(
    {
      'vitest.config.js': {
        test: {
          isolate: false,
          setupFiles: ['./setup.js'],
          fsModuleCache: true,
          fsModuleCachePath: './node_modules/.vitest-fs-cache',
        },
      },
      'setup.js': `globalThis.setupRuns = (globalThis.setupRuns ?? 0) + 1`,
      'dep.js': `export const value = 1`,
      'a.test.js': testFile,
      'b.test.js': testFile,
    },
    { related: ['dep.js'] },
  )
  const cached = await runVitest({ root: related.root })

  for (const run of [related, cached]) {
    expect(run.stderr).toBe('')
    expect(run.errorTree()).toMatchInlineSnapshot(`
      {
        "a.test.js": {
          "setup file ran before this file": "passed",
        },
        "b.test.js": {
          "setup file ran before this file": "passed",
        },
      }
    `)
  }
})

test('pre-parsing test files reuses the cache', async () => {
  const transformed: string[] = []
  ;(globalThis as any).__vitest_transformed__ = transformed

  const cold = await runInlineTests({
    'vitest.config.js': `
      import { defineConfig } from 'vitest/config'
      export default defineConfig({
        plugins: [{
          name: 'track-transforms',
          transform(_code, id) {
            if (id.startsWith(this.environment.config.root)) {
              globalThis.__vitest_transformed__.push(id.slice(this.environment.config.root.length + 1))
            }
          },
        }],
        test: {
          fsModuleCache: true,
          fsModuleCachePath: './node_modules/.vitest-fs-cache',
          experimental: { preParse: true },
        },
      })
    `,
    'a.test.js': `
      import { expect, test } from 'vitest'
      test('a', () => expect(1).toBe(1))
    `,
  })

  expect(cold.stderr).toBe('')
  expect(transformed).toEqual(['a.test.js'])

  transformed.length = 0

  const warm = await runVitest({ root: cold.root })

  expect(warm.stderr).toBe('')
  expect(warm.testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "passed",
      },
    }
  `)
  expect(transformed).toEqual([])

  delete (globalThis as any).__vitest_transformed__
})

test('if cache key generator bails out, the file is not cached', async () => {
  process.env.REPLACED = 'value1'

  const { errorTree: errorTree1 } = await runVitest({
    root: './fixtures/caching/dynamic-cache-key',
    config: './vitest.config.bails.js',
    fsModuleCache: true,
    fsModuleCachePath: './node_modules/.vitest-fs-cache',
    reporters: [
      {
        async onInit(vitest) {
          // make sure cache is empty
          await vitest.clearCache()
        },
      },
    ],
  })

  expect(errorTree1()).toMatchInlineSnapshot(`
    {
      "replaced.test.js": {
        "replaced variable is the same": "passed",
      },
    }
  `)

  process.env.REPLACED = 'value2'

  const { errorTree: errorTree2 } = await runVitest({
    root: './fixtures/caching/dynamic-cache-key',
    config: './vitest.config.bails.js',
    fsModuleCache: true,
    fsModuleCachePath: './node_modules/.vitest-fs-cache',
  })

  expect(errorTree2()).toMatchInlineSnapshot(`
    {
      "replaced.test.js": {
        "replaced variable is the same": "passed",
      },
    }
  `)
})

declare module 'vitest' {
  export interface ProvidedContext {
    generated: string[]
    names: string[]
  }
}

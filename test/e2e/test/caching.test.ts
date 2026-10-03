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
  }
}

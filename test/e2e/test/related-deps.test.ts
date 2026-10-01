import type { TestModule } from 'vitest/node'
import { resolve } from 'pathe'
import { describe, expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'
import { runInlineTests, runVitest, useFS } from '#test-utils'

function testFile(name: string, imports = '') {
  return `
    ${imports}
    import { test } from 'vitest'
    test('${name}', () => {})
  `
}

// written this way so the comment is not picked up from this file
function environmentComment(name: string) {
  return `// @vitest-${'environment'} ${name}`
}

const customEnvironment = `
export default {
  name: 'custom',
  viteEnvironment: 'ssr',
  setup() {
    return { teardown() {} }
  },
}
`

test('a file imported by a setup file runs every test', async () => {
  const { stderr, testTree } = await runInlineTests(
    {
      'vitest.config.js': { test: { setupFiles: ['./setup.js'] } },
      'setup.js': `import './src/helper.js'`,
      'src/helper.js': 'export {}',
      'a.test.js': testFile('a'),
      'b.test.js': testFile('b'),
    },
    { related: ['src/helper.js'] },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "passed",
      },
      "b.test.js": {
        "b": "passed",
      },
    }
  `)
})

test('a setup file of a project runs only the tests of that project', async () => {
  const { stderr, testTree } = await runInlineTests(
    {
      'vitest.config.js': {
        test: {
          projects: [
            { test: { name: 'first', include: ['first/*.test.js'], setupFiles: ['./setup.js'] } },
            { test: { name: 'second', include: ['second/*.test.js'] } },
          ],
        },
      },
      'setup.js': 'export {}',
      'first/a.test.js': testFile('a'),
      'second/b.test.js': testFile('b'),
    },
    { related: ['setup.js'] },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "first/a.test.js": {
        "a": "passed",
      },
    }
  `)
})

test('a file imported by a global setup runs every test', async () => {
  const { stderr, testTree } = await runInlineTests(
    {
      'vitest.config.js': { test: { globalSetup: ['./global-setup.js'] } },
      'global-setup.js': `
        import './src/helper.js'
        export default () => {}
      `,
      'src/helper.js': 'export {}',
      'a.test.js': testFile('a'),
      'b.test.js': testFile('b'),
    },
    { related: ['src/helper.js'] },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "passed",
      },
      "b.test.js": {
        "b": "passed",
      },
    }
  `)
})

test('a custom runner runs every test', async () => {
  const { stderr, testTree } = await runInlineTests(
    {
      'vitest.config.js': { test: { runner: './runner.js' } },
      'runner.js': `export { TestRunner as default } from 'vitest'`,
      'a.test.js': testFile('a'),
      'b.test.js': testFile('b'),
    },
    { related: ['runner.js'] },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "passed",
      },
      "b.test.js": {
        "b": "passed",
      },
    }
  `)
})

test('a custom environment of a project runs every test', async () => {
  const { stderr, testTree } = await runInlineTests(
    {
      'vitest.config.js': { test: { environment: './env.js' } },
      'env.js': customEnvironment,
      'a.test.js': testFile('a'),
      'b.test.js': testFile('b'),
    },
    { related: ['env.js'] },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "passed",
      },
      "b.test.js": {
        "b": "passed",
      },
    }
  `)
})

test('an environment from a comment runs only the test that uses it', async () => {
  const { stderr, testTree } = await runInlineTests(
    {
      'vitest.config.js': `
        import { fileURLToPath } from 'node:url'
        export default {
          resolve: {
            alias: {
              'vitest-environment-custom': fileURLToPath(new URL('./env.js', import.meta.url)),
            },
          },
        }
      `,
      'env.js': customEnvironment,
      'a.test.js': testFile('a', environmentComment('custom')),
      'b.test.js': testFile('b'),
    },
    { related: ['env.js'] },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "passed",
      },
    }
  `)
})

test('a file imported by the config runs every test', async () => {
  const { stderr, testTree } = await runInlineTests(
    {
      'vitest.config.js': `
        import { shared } from './vitest.shared.js'
        export default { test: shared }
      `,
      'vitest.shared.js': 'export const shared = {}',
      'a.test.js': testFile('a'),
      'b.test.js': testFile('b'),
    },
    { related: ['vitest.shared.js'] },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "passed",
      },
      "b.test.js": {
        "b": "passed",
      },
    }
  `)
})

test('a file imported by a project config runs only the tests of that project', async () => {
  const { stderr, testTree } = await runInlineTests(
    {
      'vitest.config.js': { test: { projects: ['./first', './second'] } },
      'first/vitest.config.js': `
        import { shared } from './shared.js'
        export default { test: { name: 'first', ...shared } }
      `,
      'first/shared.js': 'export const shared = {}',
      'first/a.test.js': testFile('a'),
      'second/vitest.config.js': { test: { name: 'second' } },
      'second/b.test.js': testFile('b'),
    },
    { related: ['first/shared.js'] },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "passed",
      },
    }
  `)
})

test.each([
  ['raw', 'src/data.txt', `import './src/data.txt?raw'`],
  ['url', 'src/dep.js', `import './src/dep.js?url'`],
  ['inline css', 'src/style.css', `import './src/style.css?inline'`],
  ['raw through a module', 'src/data.txt', `import './src/loader.js'`],
])(
  'a file imported with a query (%s) runs the test that imports it',
  async (_, changed, imports) => {
    const { stderr, testTree } = await runInlineTests(
      {
        'src/data.txt': 'hello',
        'src/dep.js': 'export {}',
        'src/style.css': '.a {}',
        'src/loader.js': `import './data.txt?raw'`,
        'a.test.js': testFile('a', imports),
        'b.test.js': testFile('b'),
      },
      { related: [changed] },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "passed",
      },
    }
  `)
  },
)

test.each([
  ['a dynamic import', `test('a', async () => { await import('./src/dep.js') })`],
  ['import.meta.glob', `import.meta.glob('./src/*.js', { eager: true })\ntest('a', () => {})`],
])('a module loaded with %s runs the test that loads it', async (_, body) => {
  const { stderr, testTree } = await runInlineTests(
    {
      'src/dep.js': `import './nested/nested.js'`,
      'src/nested/nested.js': 'export {}',
      'a.test.js': `
        import { test } from 'vitest'
        ${body}
      `,
      'b.test.js': testFile('b'),
    },
    { related: ['src/nested/nested.js'] },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "passed",
      },
    }
  `)
})

describe('files added with addWatchFile', () => {
  // the plugin builds src/template.js from src/template.html
  const templatePlugin = (hook: 'load' | 'transform', test = {}) => `
    import { readFileSync } from 'node:fs'
    export default {
      plugins: [{
        name: 'template',
        ${hook}(${hook === 'load' ? 'id' : '_code, id'}) {
          if (id.endsWith('/src/template.js')) {
            const html = id.replace(/\\.js$/, '.html')
            this.addWatchFile(html)
            return \`export default \${JSON.stringify(readFileSync(html, 'utf-8'))}\`
          }
        },
      }],
      test: ${JSON.stringify(test)},
    }
  `
  const files = {
    'src/template.html': '<div></div>',
    'src/template.js': 'export default ""',
    'src/wrapper.js': `import './template.js'`,
    'src/other.js': 'export {}',
    'a.test.js': testFile('a', `import './src/template.js'`),
    'b.test.js': testFile('b', `import './src/wrapper.js'`),
    'c.test.js': testFile('c', `import './src/other.js'`),
  }

  test.each(['load', 'transform'] as const)(
    'a file added in %s runs the tests that import the module',
    async (hook) => {
      const { stderr, testTree } = await runInlineTests(
        { ...files, 'vitest.config.js': templatePlugin(hook) },
        { related: ['src/template.html'] },
      )

      expect(stderr).toBe('')
      expect(testTree()).toMatchInlineSnapshot(`
        {
          "a.test.js": {
            "a": "passed",
          },
          "b.test.js": {
            "b": "passed",
          },
        }
      `)
    },
  )

  // the added file is not a module, so it must not be transformed and fail
  test.each(['load', 'transform'] as const)(
    'an unrelated change does not run the tests that import a module with a file added in %s',
    async (hook) => {
      const { stderr, testTree } = await runInlineTests(
        { ...files, 'vitest.config.js': templatePlugin(hook) },
        { related: ['src/other.js'] },
      )

      expect(stderr).toBe('')
      expect(testTree()).toMatchInlineSnapshot(`
        {
          "c.test.js": {
            "c": "passed",
          },
        }
      `)
    },
  )

  test('a file added in a plugin is followed for modules served from the fs module cache', async () => {
    const config = templatePlugin('transform', {
      fsModuleCache: true,
      fsModuleCachePath: './node_modules/.vitest-fs-cache',
    })
    const cold = await runInlineTests({ ...files, 'vitest.config.js': config })
    expect(cold.stderr).toBe('')
    await cold.ctx?.close()

    const { stderr, testTree } = await runVitest({
      root: cold.root,
      related: ['src/template.html'],
    })

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "a.test.js": {
          "a": "passed",
        },
        "b.test.js": {
          "b": "passed",
        },
      }
    `)
  })
})

test('imports are followed for modules served from the fs module cache', async () => {
  const cold = await runInlineTests({
    'vitest.config.js': {
      test: { fsModuleCache: true, fsModuleCachePath: './node_modules/.vitest-fs-cache' },
    },
    'src/data.txt': 'hello',
    'src/shared.js': `import './nested.js'`,
    'src/nested.js': 'export {}',
    'a.test.js': testFile('a', `import './src/data.txt?raw'`),
    'b.test.js': testFile('b', `import './src/shared.js'`),
    'c.test.js': testFile('c'),
  })
  expect(cold.stderr).toBe('')
  await cold.ctx?.close()

  const { stderr, testTree } = await runVitest({
    root: cold.root,
    related: ['src/data.txt', 'src/nested.js'],
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "passed",
      },
      "b.test.js": {
        "b": "passed",
      },
    }
  `)
})

test('a manual mock from __mocks__ runs only the test that mocks it', async () => {
  const { stderr, testTree } = await runInlineTests(
    {
      'src/dep.js': 'export const value = 1',
      'src/__mocks__/dep.js': 'export const value = 2',
      'a.test.js': `
        import { test, vi } from 'vitest'
        import './src/dep.js'

        vi.mock('./src/dep.js')

        test('a', () => {})
      `,
      'b.test.js': testFile('b', `import './src/dep.js'`),
    },
    { related: ['src/__mocks__/dep.js'] },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "passed",
      },
    }
  `)
})

test('the environment comment is read when filtering and reused by the run', async () => {
  const root = `${process.cwd()}/vitest-test-${crypto.randomUUID()}`
  useFS(root, {
    'a.test.js': `
      ${environmentComment('node')}
      import { test } from 'vitest'
      import './src/helper.js'

      test('a', () => {})
    `,
    'src/helper.js': 'export {}',
  })
  const vitest = await createVitest({
    root,
    watch: false,
    config: false,
    related: ['src/helper.js'],
  })
  onTestFinished(() => vitest.close())

  const [unfiltered] = await vitest.globTestSpecifications()
  expect(unfiltered._docblock).toBeUndefined()

  const [filtered] = await vitest.getRelevantTestSpecifications()
  expect(filtered._docblock).toMatchInlineSnapshot(`
    {
      "environment": {
        "name": "node",
        "options": null,
      },
      "tags": [],
    }
  `)
})

test('a force rerun trigger inside a dot folder runs every test', async () => {
  const root = resolve(process.cwd(), `.vitest-test-${crypto.randomUUID()}`)
  useFS(root, {
    'vitest.config.js': { test: { forceRerunTriggers: ['**/trigger.js'] } },
    'trigger.js': 'export {}',
    'a.test.js': testFile('a'),
    'b.test.js': testFile('b'),
  })
  const { stderr, testTree } = await runVitest({ root, related: ['trigger.js'] })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "a": "passed",
      },
      "b.test.js": {
        "b": "passed",
      },
    }
  `)
})

describe('mocked modules', () => {
  // records the files transformed by the project, relative to the root
  const trackTransforms = (config = '{}') => `
    export default {
      plugins: [{
        name: 'track-transforms',
        transform(_code, id) {
          const root = this.environment.config.root + '/'
          if (id.startsWith(root)) {
            globalThis.__transformed?.push(id.slice(root.length))
          }
        },
      }],
      test: ${config},
    }
  `

  function useTransformed() {
    const transformed: string[] = []
    ;(globalThis as any).__transformed = transformed
    onTestFinished(() => {
      delete (globalThis as any).__transformed
    })
    return transformed
  }

  const mockedTest = (mock: string) => `
    import { test, vi } from 'vitest'
    import './src/dep.js'

    ${mock}

    test('a', () => {})
  `

  test('a module mocked with a factory is not transformed', async () => {
    const transformed = useTransformed()
    const { stderr, testTree } = await runInlineTests(
      {
        'vitest.config.js': trackTransforms(),
        'src/dep.js': `import './nested.js'`,
        'src/nested.js': 'export {}',
        'src/other.js': 'export {}',
        'a.test.js': mockedTest(`vi.mock('./src/dep.js', () => ({}))`),
        'b.test.js': testFile('b', `import './src/other.js'`),
      },
      { related: ['src/other.js'] },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "b.test.js": {
          "b": "passed",
        },
      }
    `)
    expect(transformed.sort()).toMatchInlineSnapshot(`
      [
        "a.test.js",
        "b.test.js",
        "src/other.js",
      ]
    `)
  })

  test('changing a module mocked with a factory does not run the test', async () => {
    const { stderr, testTree } = await runInlineTests(
      {
        'vitest.config.js': trackTransforms(),
        'src/dep.js': `import './nested.js'`,
        'src/nested.js': 'export {}',
        'a.test.js': mockedTest(`vi.mock('./src/dep.js', () => ({}))`),
        'b.test.js': testFile('b', `import './src/dep.js'`),
      },
      { related: ['src/nested.js'] },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "b.test.js": {
          "b": "passed",
        },
      }
    `)
  })

  test('a module redirected to __mocks__ is not transformed', async () => {
    const transformed = useTransformed()
    const { stderr, testTree } = await runInlineTests(
      {
        'vitest.config.js': trackTransforms(),
        'src/dep.js': 'export {}',
        'src/__mocks__/dep.js': 'export {}',
        'src/other.js': 'export {}',
        'a.test.js': mockedTest(`vi.mock('./src/dep.js')`),
        'b.test.js': testFile('b', `import './src/other.js'`),
      },
      { related: ['src/dep.js', 'src/other.js'] },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "b.test.js": {
          "b": "passed",
        },
      }
    `)
    expect(transformed.sort()).toMatchInlineSnapshot(`
      [
        "a.test.js",
        "b.test.js",
        "src/__mocks__/dep.js",
        "src/other.js",
      ]
    `)
  })

  test.each([
    [
      'a factory with importOriginal',
      `vi.mock('./src/dep.js', async (importOriginal) => importOriginal())`,
    ],
    ['an automock', `vi.mock('./src/dep.js')`],
    ['a spy', `vi.mock('./src/dep.js', { spy: true })`],
  ])('a module mocked with %s still runs the test', async (_, mock) => {
    const { stderr, testTree } = await runInlineTests(
      {
        'vitest.config.js': trackTransforms(),
        'src/dep.js': 'export {}',
        'a.test.js': mockedTest(mock),
      },
      { related: ['src/dep.js'] },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "a.test.js": {
          "a": "passed",
        },
      }
    `)
  })

  test('a module mocked in a setup file is not transformed for any test', async () => {
    const transformed = useTransformed()
    const { stderr, testTree } = await runInlineTests(
      {
        'vitest.config.js': trackTransforms(`{ setupFiles: ['./setup.js'] }`),
        'setup.js': `
          import { vi } from 'vitest'
          vi.mock('./src/dep.js', () => ({}))
        `,
        'src/dep.js': 'export {}',
        'src/other.js': 'export {}',
        'a.test.js': testFile('a', `import './src/dep.js'`),
        'b.test.js': `
          import { test } from 'vitest'
          import './src/dep.js'
          import './src/other.js'

          test('b', () => {})
        `,
      },
      { related: ['src/dep.js', 'src/other.js'] },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "b.test.js": {
          "b": "passed",
        },
      }
    `)
    expect(transformed.sort()).toMatchInlineSnapshot(`
      [
        "a.test.js",
        "b.test.js",
        "setup.js",
        "src/other.js",
      ]
    `)
  })

  test('a test with its own mocks still runs when a shared module is affected', async () => {
    const { stderr, testTree } = await runInlineTests(
      {
        'src/dep.js': 'export {}',
        'src/shared.js': `import './changed.js'`,
        'src/changed.js': 'export {}',
        'a.test.js': `
          import { test, vi } from 'vitest'
          import './src/dep.js'
          import './src/shared.js'

          vi.mock('./src/dep.js', () => ({}))

          test('a', () => {})
        `,
        'b.test.js': testFile('b', `import './src/shared.js'`),
      },
      { related: ['src/changed.js'] },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "a.test.js": {
          "a": "passed",
        },
        "b.test.js": {
          "b": "passed",
        },
      }
    `)
  })

  test('a module mocked in one test is still transformed for a test that imports it', async () => {
    const transformed = useTransformed()
    const { stderr, testTree } = await runInlineTests(
      {
        'vitest.config.js': trackTransforms(),
        'src/dep.js': `import './nested.js'`,
        'src/nested.js': 'export {}',
        'a.test.js': mockedTest(`vi.mock('./src/dep.js', () => ({}))`),
        'b.test.js': testFile('b', `import './src/dep.js'`),
      },
      { related: ['src/nested.js'] },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "b.test.js": {
          "b": "passed",
        },
      }
    `)
    expect(transformed.sort()).toMatchInlineSnapshot(`
      [
        "a.test.js",
        "b.test.js",
        "src/dep.js",
        "src/nested.js",
      ]
    `)
  })

  test('a module mocked behind a shared module is still walked for a test that does not mock it', async () => {
    const { stderr, testTree } = await runInlineTests(
      {
        'src/shared.js': `import './dep.js'`,
        'src/dep.js': `import './nested.js'`,
        'src/nested.js': 'export {}',
        'a.test.js': `
          import { test, vi } from 'vitest'
          import './src/shared.js'

          vi.mock('./src/dep.js', () => ({}))

          test('a', () => {})
        `,
        'b.test.js': testFile('b', `import './src/shared.js'`),
      },
      { related: ['src/nested.js'] },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "b.test.js": {
          "b": "passed",
        },
      }
    `)
  })

  test('a package redirected to the root __mocks__ is followed', async () => {
    const { stderr, testTree } = await runInlineTests(
      {
        '__mocks__/tinyspy.js': `
          import '../src/helper.js'
          export const spyOn = () => {}
        `,
        'src/helper.js': 'export {}',
        'a.test.js': `
          import { test, vi } from 'vitest'
          import 'tinyspy'

          vi.mock('tinyspy')

          test('a', () => {})
        `,
        'b.test.js': testFile('b', `import 'tinyspy'`),
      },
      { related: ['src/helper.js'] },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "a.test.js": {
          "a": "passed",
        },
      }
    `)
  })

  test('a mock inside an imported module does not skip the mocked module', async () => {
    const { stderr, testTree } = await runInlineTests(
      {
        'src/dep.js': 'export {}',
        'src/helper.js': `
          import { vi } from 'vitest'
          vi.mock('./dep.js', () => ({}))
        `,
        'a.test.js': `
          import { test } from 'vitest'
          import './src/helper.js'
          import './src/dep.js'

          test('a', () => {})
        `,
      },
      { related: ['src/dep.js'] },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "a.test.js": {
          "a": "passed",
        },
      }
    `)
  })
})

describe('files loaded for every test', () => {
  test.each([
    [
      'snapshotSerializers',
      { snapshotSerializers: ['./loaded.js'] },
      `export default { serialize: () => '', test: () => false }`,
    ],
    [
      'snapshotEnvironment',
      { snapshotEnvironment: './loaded.js' },
      `
        import { VitestSnapshotEnvironment } from 'vitest/runtime'
        export default new VitestSnapshotEnvironment()
      `,
    ],
    ['diff', { diff: './loaded.js' }, 'export default {}'],
    ['runner', { runner: './loaded.js' }, `export { TestRunner as default } from 'vitest'`],
    ['environment', { environment: './loaded.js' }, customEnvironment],
  ])('a file imported by %s runs every test', async (_, config, content) => {
    const { stderr, testTree } = await runInlineTests(
      {
        'vitest.config.js': { test: config },
        'loaded.js': `
          import './src/helper.js'
          ${content}
        `,
        'src/helper.js': 'export {}',
        'a.test.js': testFile('a'),
        'b.test.js': testFile('b'),
      },
      { related: ['src/helper.js'] },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "a.test.js": {
          "a": "passed",
        },
        "b.test.js": {
          "b": "passed",
        },
      }
    `)
  })

  test('an unrelated change runs only the tests that import it', async () => {
    const { stderr, testTree } = await runInlineTests(
      {
        'vitest.config.js': { test: { setupFiles: ['./setup.js'], runner: './runner.js' } },
        'setup.js': `import './src/helper.js'`,
        'runner.js': `export { TestRunner as default } from 'vitest'`,
        'src/helper.js': 'export {}',
        'src/other.js': 'export {}',
        'a.test.js': testFile('a', `import './src/other.js'`),
        'b.test.js': testFile('b'),
      },
      { related: ['src/other.js'] },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "a.test.js": {
          "a": "passed",
        },
      }
    `)
  })
})

describe('modules that fail to load', () => {
  const broken = 'export const = 1'

  test('a test that imports a broken module runs and reports the error', async () => {
    const { results } = await runInlineTests(
      {
        'src/broken.js': broken,
        'src/changed.js': 'export {}',
        'src/other.js': 'export {}',
        'a.test.js': testFile('a', `import './src/broken.js'`),
        'b.test.js': testFile('b', `import './src/changed.js'`),
        'c.test.js': testFile('c', `import './src/other.js'`),
      },
      { related: ['src/changed.js'] },
    )

    expect(moduleStates(results)).toMatchInlineSnapshot(`
      [
        [
          "a.test.js",
          "failed",
        ],
        [
          "b.test.js",
          "passed",
        ],
      ]
    `)
  })

  test('a broken test file runs and reports the error', async () => {
    const { results } = await runInlineTests(
      {
        'src/changed.js': 'export {}',
        'a.test.js': broken,
        'b.test.js': testFile('b', `import './src/changed.js'`),
        'c.test.js': testFile('c'),
      },
      { related: ['src/changed.js'] },
    )

    expect(moduleStates(results)).toMatchInlineSnapshot(`
      [
        [
          "a.test.js",
          "failed",
        ],
        [
          "b.test.js",
          "passed",
        ],
      ]
    `)
  })

  test('a broken setup file runs every test', async () => {
    const { results } = await runInlineTests(
      {
        'vitest.config.js': { test: { setupFiles: ['./setup.js'] } },
        'setup.js': broken,
        'src/changed.js': 'export {}',
        'a.test.js': testFile('a'),
        'b.test.js': testFile('b', `import './src/changed.js'`),
      },
      { related: ['src/changed.js'] },
    )

    expect(moduleStates(results)).toMatchInlineSnapshot(`
      [
        [
          "a.test.js",
          "failed",
        ],
        [
          "b.test.js",
          "failed",
        ],
      ]
    `)
  })

  function moduleStates(modules: TestModule[]) {
    return modules
      .map((testModule) => [testModule.relativeModuleId, testModule.state()])
      .sort(([a], [b]) => a.localeCompare(b))
  }
})

describe('projects', () => {
  test('a file imported by the root config runs the tests of every project', async () => {
    const { stderr, testTree } = await runInlineTests(
      {
        'vitest.config.js': `
          import { shared } from './vitest.shared.js'
          export default {
            test: {
              projects: [
                { test: { ...shared, name: 'first', include: ['first/*.test.js'] } },
                { test: { ...shared, name: 'second', include: ['second/*.test.js'] } },
              ],
            },
          }
        `,
        'vitest.shared.js': 'export const shared = {}',
        'first/a.test.js': testFile('a'),
        'second/b.test.js': testFile('b'),
      },
      { related: ['vitest.shared.js'] },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "first/a.test.js": {
          "a": "passed",
        },
        "second/b.test.js": {
          "b": "passed",
        },
      }
    `)
  })

  test('a file imported by the root config runs the tests of every config project', async () => {
    const { stderr, testTree } = await runInlineTests(
      {
        'vitest.config.js': `
          import './vitest.shared.js'
          export default { test: { projects: ['./first', './second'] } }
        `,
        'vitest.shared.js': 'export {}',
        'first/vitest.config.js': { test: { name: 'first' } },
        'first/a.test.js': testFile('a'),
        'second/vitest.config.js': { test: { name: 'second' } },
        'second/b.test.js': testFile('b'),
      },
      { related: ['vitest.shared.js'] },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "a.test.js": {
          "a": "passed",
        },
        "b.test.js": {
          "b": "passed",
        },
      }
    `)
  })

  test('a setup file defined in a project config runs only the tests of that project', async () => {
    const { stderr, testTree } = await runInlineTests(
      {
        'vitest.config.js': { test: { projects: ['./first', './second'] } },
        'first/vitest.config.js': { test: { name: 'first', setupFiles: ['./setup.js'] } },
        'first/setup.js': `import '../src/helper.js'`,
        'first/a.test.js': testFile('a'),
        'second/vitest.config.js': { test: { name: 'second' } },
        'second/b.test.js': testFile('b'),
        'src/helper.js': 'export {}',
      },
      { related: ['src/helper.js'] },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "a.test.js": {
          "a": "passed",
        },
      }
    `)
  })

  test('a mock in a setup file applies only to the tests of that project', async () => {
    const { stderr, testTree } = await runInlineTests(
      {
        'vitest.config.js': {
          test: {
            projects: [
              { test: { name: 'first', include: ['first/*.test.js'], setupFiles: ['./setup.js'] } },
              { test: { name: 'second', include: ['second/*.test.js'] } },
            ],
          },
        },
        'setup.js': `
          import { vi } from 'vitest'
          vi.mock('./src/dep.js', () => ({}))
        `,
        'src/dep.js': 'export {}',
        'first/a.test.js': testFile('a', `import '../src/dep.js'`),
        'second/b.test.js': testFile('b', `import '../src/dep.js'`),
      },
      { related: ['src/dep.js'] },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "second/b.test.js": {
          "b": "passed",
        },
      }
    `)
  })

  test('the same test file runs only in the project affected by the change', async () => {
    const { stderr, buildTree } = await runInlineTests(
      {
        'vitest.config.js': {
          test: {
            projects: [
              { test: { name: 'first', setupFiles: ['./setup.js'] } },
              { test: { name: 'second' } },
            ],
          },
        },
        'setup.js': `import './src/helper.js'`,
        'src/helper.js': 'export {}',
        'a.test.js': testFile('a'),
      },
      { related: ['src/helper.js'] },
    )

    expect(stderr).toBe('')
    expect(buildTree((testCase) => testCase.project.name)).toMatchInlineSnapshot(`
      {
        "a.test.js": {
          "a": "first",
        },
      }
    `)
  })
})

test('the environment comment is ignored for browser tests', async () => {
  const root = `${process.cwd()}/vitest-test-${crypto.randomUUID()}`
  useFS(root, {
    'vitest.config.js': `
      import { playwright } from '@vitest/browser-playwright'
      export default {
        test: {
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      }
    `,
    'a.test.js': `
      ${environmentComment('custom')}
      import { test } from 'vitest'
      import './src/helper.js'

      test('a', () => {})
    `,
    'src/helper.js': 'export {}',
  })
  const vitest = await createVitest({ root, watch: false, related: ['src/helper.js'] })
  onTestFinished(() => vitest.close())

  const specifications = await vitest.getRelevantTestSpecifications()
  expect(specifications.map((spec) => [spec.pool, spec._docblock])).toMatchInlineSnapshot(`
    [
      [
        "browser",
        undefined,
      ],
    ]
  `)
})

test('the run uses the environment comment read when filtering', async () => {
  const root = `${process.cwd()}/vitest-test-${crypto.randomUUID()}`
  const { editFile } = useFS(root, {
    'vitest.config.js': `
      import { fileURLToPath } from 'node:url'
      export default {
        resolve: {
          alias: {
            'vitest-environment-custom': fileURLToPath(new URL('./env.js', import.meta.url)),
          },
        },
      }
    `,
    'env.js': `
      export default {
        name: 'custom',
        viteEnvironment: 'ssr',
        setup() {
          globalThis.__environment = 'custom'
          return { teardown() { delete globalThis.__environment } }
        },
      }
    `,
    'a.test.js': `
      ${environmentComment('custom')}
      import { expect, test } from 'vitest'

      test('environment', () => expect(globalThis.__environment).toBe('custom'))
    `,
  })
  const vitest = await createVitest({ root, watch: false, reporters: [{}], related: ['env.js'] })
  onTestFinished(() => vitest.close())

  const specifications = await vitest.getRelevantTestSpecifications()
  // the file is not read again, so the run still uses the environment from the comment
  editFile('a.test.js', (content) => content.replace(environmentComment('custom'), ''))

  const { testModules } = await vitest.runTestSpecifications(specifications)
  expect(testModules.map((testModule) => testModule.state())).toEqual(['passed'])
})

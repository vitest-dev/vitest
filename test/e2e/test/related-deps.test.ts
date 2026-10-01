import { describe, expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'
import { runInlineTests, useFS } from '#test-utils'

function testFile(name: string, imports = '') {
  return `${imports}\nimport { test } from 'vitest'\ntest('${name}', () => {})\n`
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
      'global-setup.js': `import './src/helper.js'\nexport default () => {}`,
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

test('a manual mock from __mocks__ runs only the test that mocks it', async () => {
  const { stderr, testTree } = await runInlineTests(
    {
      'src/dep.js': 'export const value = 1',
      'src/__mocks__/dep.js': 'export const value = 2',
      'a.test.js': testFile(
        'a',
        `import { vi } from 'vitest'\nimport './src/dep.js'\nvi.mock('./src/dep.js')`,
      ),
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
    'a.test.js': testFile('a', `${environmentComment('node')}\nimport './src/helper.js'`),
    'src/helper.js': 'export {}',
  })
  const vitest = await createVitest('test', { root, watch: false, config: false })
  onTestFinished(() => vitest.close())

  const [unfiltered] = await vitest.globTestSpecifications()
  expect(unfiltered._docblock).toBeUndefined()

  vitest.config.related = [`${root}/src/helper.js`]
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

  const mockedTest = (mock: string) =>
    testFile('a', `import { vi } from 'vitest'\nimport './src/dep.js'\n${mock}`)

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
        'setup.js': `import { vi } from 'vitest'\nvi.mock('./src/dep.js', () => ({}))\n`,
        'src/dep.js': 'export {}',
        'src/other.js': 'export {}',
        'a.test.js': testFile('a', `import './src/dep.js'`),
        'b.test.js': testFile('b', `import './src/dep.js'\nimport './src/other.js'`),
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
})

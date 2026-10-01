import { describe, expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'
import { runInlineTests, useFS } from '#test-utils'

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

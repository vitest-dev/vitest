import module from 'node:module'
import { expect, test } from 'vitest'
import { replaceRoot, runInlineTests } from '../../test-utils'

describe.runIf(module.registerHooks)('when module.registerHooks is supported', () => {
  test.skip('cannot run viteModuleRunner: false in "vmForks"', async () => {
    const { stderr } = await runInlineTests({
      'base.test.js': ``,
      'vitest.config.js': {
        test: {
          pool: 'vmForks',
          experimental: {
            viteModuleRunner: false,
          },
        },
      },
    })

    expect(stderr).toContain(`Pool "vmForks" cannot run with "experimental.viteModuleRunner: false". Please, use "threads" or "forks" instead.`)
  })

  test.skip('cannot run viteModuleRunner: false in "vmThreads"', async () => {
    const { stderr } = await runInlineTests({
      'base.test.js': ``,
      'vitest.config.js': {
        test: {
          pool: 'vmThreads',
          experimental: {
            viteModuleRunner: false,
          },
        },
      },
    })

    expect(stderr).toContain(`Pool "vmThreads" cannot run with "experimental.viteModuleRunner: false". Please, use "threads" or "forks" instead.`)
  })

  test('can run tests in threads worker', async () => {
    const { stderr, testTree } = await runInlineTests({
      'base1.test.js': `
test('hello world', () => {})
    `,
      'base2.test.js': `
test('hello world', () => {})
    `,
      'vitest.config.js': {
        test: {
          globals: true,
          pool: 'threads',
          experimental: {
            viteModuleRunner: false,
          },
        },
      },
    })

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
    {
      "base1.test.js": {
        "hello world": "passed",
      },
      "base2.test.js": {
        "hello world": "passed",
      },
    }
  `)
  })

  test('can run tests in forks worker', async () => {
    const { stderr, testTree } = await runInlineTests({
      'base1.test.js': `
test('hello world', () => {})
    `,
      'base2.test.js': `
test('hello world', () => {})
    `,
      'vitest.config.js': {
        test: {
          globals: true,
          pool: 'forks',
          experimental: {
            viteModuleRunner: false,
          },
        },
      },
    })

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
    {
      "base1.test.js": {
        "hello world": "passed",
      },
      "base2.test.js": {
        "hello world": "passed",
      },
    }
  `)
  })

  test('ESM files don\'t have access to CJS globals', async () => {
    const { stderr, testTree } = await runInlineTests({
      'base.test.js': `
test('no globals', () => {
  expect(typeof __dirname).toBe('undefined')
  expect(typeof __filename).toBe('undefined')
  expect(typeof exports).toBe('undefined')
  expect(typeof module).toBe('undefined')
})

test('no vite globals', () => {
  expect(typeof import.meta).toBe('object')
  expect(typeof import.meta.env).toBe('undefined')
})
    `,
      'package.json': JSON.stringify({
        name: '@test/no-globals-cjs-esm-native-module-runner',
        type: 'module',
      }),
      'vitest.config.js': {
        test: {
          globals: true,
          experimental: {
            viteModuleRunner: false,
          },
        },
      },
    })

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
    {
      "base.test.js": {
        "no globals": "passed",
        "no vite globals": "passed",
      },
    }
  `)
  })

  test('CJS files don\'t have access to ESM globals', async () => {
    const { stderr, testTree } = await runInlineTests({
      'base.test.js': `
test('has CJS globals', () => {
  expect(typeof __dirname).toBe('string')
  expect(typeof __filename).toBe('string')
  expect(typeof exports).toBe('object')
  expect(typeof module).toBe('object')
})
    `,
      'esm.test.js': `
test('no esm globals', () => {
  expect(typeof import.meta).toBe('undefined')
})
    `,
      'package.json': JSON.stringify({
        name: '@test/no-globals-esm-cjs-native-module-runner',
        type: 'commonjs',
      }),
      'vitest.config.js': {
        test: {
          globals: true,
          experimental: {
            viteModuleRunner: false,
          },
        },
      },
    })

    expect(stderr).toContain('Cannot use \'import.meta\' outside a module')
    expect(testTree()).toMatchInlineSnapshot(`
    {
      "base.test.js": {
        "has CJS globals": "passed",
      },
      "esm.test.js": {},
    }
  `)
  })

  test('in-source tests in CJS work', async () => {
    const { stderr, testTree } = await runInlineTests({
      'in-source.js': `
if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest
  test('works', () => {
    expect(import.meta.vitest).toBeDefined()
  })
}
    `,
      'package.json': JSON.stringify({
        name: '@test/no-globals-esm-cjs-native-module-runner',
        type: 'commonjs',
      }),
      'vitest.config.js': {
        test: {
          globals: true,
          includeSource: ['./in-source.js'],
          experimental: {
            viteModuleRunner: false,
          },
        },
      },
    })
    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
    {
      "in-source.js": {
        "works": "passed",
      },
    }
  `)
  })

  test('in-source tests in ESM work', async () => {
    const { stderr, testTree } = await runInlineTests({
      'in-source.js': `
if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest
  test('works', () => {
    expect(import.meta.vitest).toBeDefined()
  })
}
    `,
      'package.json': JSON.stringify({
        name: '@test/no-globals-cjs-esm-native-module-runner',
        type: 'module',
      }),
      'vitest.config.js': {
        test: {
          globals: true,
          includeSource: ['./in-source.js'],
          experimental: {
            viteModuleRunner: false,
          },
        },
      },
    })
    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
    {
      "in-source.js": {
        "works": "passed",
      },
    }
  `)
  })

  test('in-source test doesn\'t run when imported by actual test', async () => {
    const { stderr, testTree } = await runInlineTests({
      'add.js': /* js */`
export function add(a, b) {
  return a + b
}

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest
  test('adds', () => {
    expect(add(1, 1)).toBe(2)
  })
}
    `,
      'add.test.js': /* js */`
import { add } from './add.js'
import { test, expect } from 'vitest'
test('add is only once', () => {
  expect(add(1, 1)).toBe(2)
})
    `,
      'package.json': JSON.stringify({
        name: '@test/native-module-runner',
        type: 'module',
      }),
      'vitest.config.js': {
        test: {
          includeSource: ['./in-source.js'],
          experimental: {
            viteModuleRunner: false,
          },
        },
      },
    })
    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
    {
      "add.test.js": {
        "add is only once": "passed",
      },
    }
  `)
  })

  test('cannot import JS file without extension in ESM', async () => {
    const { stderr, root } = await runInlineTests({
      'add.js': /* js */`
export function add(a, b) {
  return a + b
}
    `,
      'add.test.js': /* js */`
import { add } from './add' // no extension
test('not reported')
    `,
      'vitest.config.js': {
        test: {
          globals: true,
          experimental: {
            viteModuleRunner: false,
          },
        },
      },
    })
    expect(replaceRoot(stderr, root)).toMatchInlineSnapshot(`
      "
      ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

       FAIL  add.test.js [ add.test.js ]
      Error: Cannot find module '<root>/add' imported from <root>/add.test.js
      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
      Serialized Error: { code: 'ERR_MODULE_NOT_FOUND', url: '<urlRoot>/add' }
      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

      "
    `)
  })

  test('cannot import TS without extension in ESM', async () => {
    const { stderr, root } = await runInlineTests({
      'add.ts': /* js */`
export function add(a, b) {
  return a + b
}
    `,
      'add.test.js': /* js */`
import { add } from './add.js' // JS extension is NOT valid
test('not reported')
    `,
      'vitest.config.js': {
        test: {
          globals: true,
          experimental: {
            viteModuleRunner: false,
          },
        },
      },
    })
    expect(replaceRoot(stderr, root)).toMatchInlineSnapshot(`
      "
      ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

       FAIL  add.test.js [ add.test.js ]
      Error: Cannot find module '<root>/add.js' imported from <root>/add.test.js
      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
      Serialized Error: { code: 'ERR_MODULE_NOT_FOUND', url: '<urlRoot>/add.js' }
      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

      "
    `)
  })

  test.runIf(process.features.typescript)('an error in in-source tests is shown correctly', async () => {
    const { stderr, errorTree } = await runInlineTests({
      'in-source.ts': `
interface HelloWorld {
  isStripped: true
}

if (import.meta.vitest) {
  const {
    test,
    expect
  } = import.meta.vitest

  test('works', () => {
    throw new Error('test throws correctly')
  })
}
    `,
      'package.json': JSON.stringify({
        name: '@test/no-globals-cjs-esm-native-module-runner',
        type: 'module',
      }),
      'vitest.config.js': {
        test: {
          globals: true,
          includeTaskLocation: true,
          includeSource: ['./in-source.ts'],
          experimental: {
            viteModuleRunner: false,
          },
        },
      },
    })
    expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  in-source.ts:12:3 > works
    Error: test throws correctly
     ❯ <anonymous> in-source.ts:13:11
         11| 
         12|   test('works', () => {
         13|     throw new Error('test throws correctly')
           |           ^
         14|   })
         15| }

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
    expect(errorTree()).toMatchInlineSnapshot(`
    {
      "in-source.ts": {
        "works": [
          "test throws correctly",
        ],
      },
    }
  `)
  })

  test('error in the sync mock factory is reporter', async () => {
    const { stderr } = await runInlineTests({
      'add.js': /* js */`
export function add(a, b) {
  return a + b
}
    `,
      'add.test.js': /* js */`
import { add } from './add.js'
vi.mock('./add.js', () => {
  throw new Error('error from factory')
})
test('not reported')
    `,
      'vitest.config.js': {
        test: {
          globals: true,
          experimental: {
            viteModuleRunner: false,
          },
        },
      },
    })

    expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  add.test.js [ add.test.js ]
    Error: [vitest] There was an error when mocking a module. If you are using "vi.mock" factory, make sure there are no top level variables inside, since this call is hoisted to top of the file. Read more: https://vitest.dev/api/vi.html#vi-mock
     ❯ add.js?mock=manual:2:65
     ❯ <anonymous> add.test.js:2:1
          1| 
          2| import { add } from './add.js'
           | ^
          3| vi.mock('./add.js', () => {
          4|   throw new Error('error from factory')

    Caused by: Error: error from factory
     ❯ <anonymous> add.test.js:4:9
     ❯ add.js?mock=manual:2:65
     ❯ <anonymous> add.test.js:2:1

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  })

  test('error in the async mock factory is reporter', async () => {
  // async error is reported also as unhandled exception
  // I wasn't able to figure out what doesn't handle it properly
  // and assume it is something internal in Node.js
  // If it wasn't caught by us, we wouldn't have gotten the "suite" issue
    const { stderr } = await runInlineTests({
      'add.js': /* js */`
export function add(a, b) {
  return a + b
}
    `,
      'add.test.js': /* js */`
import { add } from './add.js'
vi.mock('./add.js', async () => {
  await Promise.resolve()
  throw new Error('error from factory')
})
test('not reported')
    `,
      'vitest.config.js': {
        test: {
          globals: true,
          experimental: {
            viteModuleRunner: false,
          },
        },
      },
    })

    // "slice" remove the stack from unhandled error because it referenced built artifacts
    expect(stderr.split('\n').slice(0, 17).join('\n')).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  add.test.js [ add.test.js ]
    Error: [vitest] There was an error when mocking a module. If you are using "vi.mock" factory, make sure there are no top level variables inside, since this call is hoisted to top of the file. Read more: https://vitest.dev/api/vi.html#vi-mock
    Caused by: Error: error from factory
     ❯ <anonymous> add.test.js:5:9

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    ⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯

    Vitest caught 1 unhandled error during the test run.
    This might cause false positive tests. Resolve unhandled errors to make sure your tests are not affected.

    ⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯
    Error: [vitest] There was an error when mocking a module. If you are using "vi.mock" factory, make sure there are no top level variables inside, since this call is hoisted to top of the file. Read more: https://vitest.dev/api/vi.html#vi-mock"
  `)
  })
})

describe.runIf(!module.registerHooks)('when module.registerHooks is not supported', () => {
  test('prints a warning if nodeLoader is not enabled', async () => {
    const { stderr } = await runInlineTests({
      'basic.test.js': `test('skip')`,
    }, {
      globals: true,
      experimental: {
        viteModuleRunner: false,
      },
    })
    expect(stderr).toContain(`WARNING  "module.registerHooks" is not supported in Node.js ${process.version}. This means that some features like module mocking or in-source testing are not supported. Upgrade your Node.js version to at least 22.15 or disable "experimental.nodeLoader" flag manually.`)
  })
})

// TODO: watch mode tests
// TODO: inline snapshot tests

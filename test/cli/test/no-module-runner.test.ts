import type { RunVitestConfig, TestFsStructure, VitestRunnerCLIOptions } from '#test-utils'
import { rmSync } from 'node:fs'
import module from 'node:module'
import { replaceRoot, runInlineTests, runVitest } from '#test-utils'
import { describe, expect, onTestFinished, test } from 'vitest'
import { readCoverageJson } from '../../coverage-test/utils'

describe.runIf(module.registerHooks)('supported', () => {
  test.for([
    {
      isolate: false,
      maxWorkers: 1,
    },
    {
      isolate: false,
      maxWorkers: 4,
      fileParallelism: true, // default
    },
    {
      isolate: true,
      maxWorkers: 1,
    },
  ] satisfies RunVitestConfig[])('runs tests inside correctly with %o', async (options) => {
    const { stderr, testTree } = await runVitest({
      root: './fixtures/no-module-runner',
      ...options,
    })
    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "src/in-source/add.ts": {
          "add": "passed",
        },
        "src/in-source/fibonacci.ts": {
          "fibonacci": "passed",
        },
        "test/automock.test.ts": {
          "fs is mocked": "passed",
          "squared is mocked": "passed",
        },
        "test/autospy.test.ts": {
          "fs is mocked": "passed",
          "squared is mocked": "passed",
        },
        "test/basic.test.ts": {
          "JSON": "passed",
          "Math.sqrt()": "passed",
          "Squared": "passed",
          "add": "passed",
        },
        "test/manual-mock.test.ts": {
          "builtin node modules are mocked": "passed",
          "deps in node_modules are mocked": "passed",
          "exports are mocked": "passed",
          "importMock works": "passed",
        },
        "test/mock-async-factory.test.ts": {
          "imported value is defined": "passed",
        },
        "test/redirect-mock.test.ts": {
          "squared is mocked": "passed",
        },
        "test/suite.test.ts": {
          "suite name": {
            "foo": "passed",
            "inline snapshot": "passed",
            "setups work": "passed",
            "snapshot": "passed",
          },
        },
      }
    `)
  })

  // TODO: move to coverage-test project
  test.skip('v8 coverage works', async () => {
    const { stderr } = await runVitest({
      root: './fixtures/no-module-runner',
      isolate: false,
      maxWorkers: 1,
      coverage: {
        enabled: true,
        reporter: [['json', { file: './coverage-final.json' }]],
      },
    })
    onTestFinished(() => {
      rmSync('./fixtures/no-module-runner/coverage', { recursive: true, force: true })
    })
    expect(stderr).toBe('')
    expect(await readCoverageJson('./fixtures/no-module-runner/coverage/coverage-final.json')).toMatchSnapshot()
  })

  test('istanbul coverage throws an error', async () => {
    const { stderr } = await runNoViteModuleRunnerTests(
      { 'base.test.js': `` },
      { coverage: { provider: 'istanbul', enabled: true } },
      { fails: true },
    )
    expect(stderr).toContain('"Istanbul" coverage provider is not compatible with "experimental.viteModuleRunner: false". Please, enable "viteModuleRunner" or switch to "v8" coverage provider.')
  })

  test('editing test file in watch mode triggers rerun', async () => {
    const { fs, vitest } = await runNoViteModuleRunnerTests({
      'base.test.js': `
        test('hello world', () => {})
      `,
    }, { watch: true })

    await vitest.waitForStdout('1 passed')

    fs.editFile('base.test.js', code => code.replace('hello world', 'hello vitest'))

    await vitest.waitForStdout('RERUN  ../base.test.js')
    await vitest.waitForStdout('hello vitest')
    await vitest.waitForStdout('1 passed')
  })

  test('editing imported file in watch mode triggers rerun', async () => {
    const { fs, vitest } = await runNoViteModuleRunnerTests({
      'imported.js': `
        export function greet() { return 'hello world' }
      `,
      'base.test.js': `
        import { greet } from './imported.js'
        test(greet(), () => {})
      `,
    }, { watch: true })

    await vitest.waitForStdout('1 passed')

    fs.editFile('imported.js', code => code.replace('hello world', 'hello vitest'))

    await vitest.waitForStdout('RERUN  ../imported.js')
    await vitest.waitForStdout('hello vitest')
    await vitest.waitForStdout('1 passed')
  })

  test('editing mocked imported file in watch mode triggers rerun', async () => {
    const { fs, vitest } = await runNoViteModuleRunnerTests({
      'imported.js': `
        export function greet() { return 'hello world' }
      `,
      'base.test.js': `
        import { greet } from './imported.js'
        vi.mock('./imported.js', { spy: true })
        test(greet(), () => {
          expect(greet).toHaveBeenCalledOnce()
        })
      `,
    }, { watch: true })

    await vitest.waitForStdout('1 passed')

    fs.editFile('imported.js', code => code.replace('hello world', 'hello vitest'))

    await vitest.waitForStdout('RERUN  ../imported.js')
    await vitest.waitForStdout('hello vitest')
    await vitest.waitForStdout('1 passed')
  })

  test('updating inline snapshots works', async () => {
    const { fs, stdout } = await runNoViteModuleRunnerTests({
      'base.test.ts': `
        interface HelloWorld {
          hello: string
        }

        test('inline snapshot', (context: any) => {
          expect({ hello: 'world' }).toMatchInlineSnapshot()
        })

        test('second snapshot', () => {
          expect({
            hello: 'vitest',
          }).toMatchInlineSnapshot()
        })
      `,
    }, { update: true })
    const updatedContent = fs.readFile('base.test.ts')
    expect(stdout).toContain('Snapshots  2 written')
    expect(updatedContent).toMatchInlineSnapshot(`
      "
              interface HelloWorld {
                hello: string
              }

              test('inline snapshot', (context: any) => {
                expect({ hello: 'world' }).toMatchInlineSnapshot(\`
                  {
                    "hello": "world",
                  }
                \`)
              })

              test('second snapshot', () => {
                expect({
                  hello: 'vitest',
                }).toMatchInlineSnapshot(\`
                  {
                    "hello": "vitest",
                  }
                \`)
              })
            "
    `)
  })

  test('cannot run viteModuleRunner: false in "vmForks"', async () => {
    const { stderr } = await runNoViteModuleRunnerTests(
      { 'base.test.js': `` },
      { pool: 'vmForks' },
    )

    expect(stderr).toContain(`Pool "vmForks" cannot run with "experimental.viteModuleRunner: false". Please, use "threads" or "forks" instead.`)
  })

  test('cannot run viteModuleRunner: false in "vmThreads"', async () => {
    const { stderr } = await runNoViteModuleRunnerTests(
      { 'base.test.js': `` },
      { pool: 'vmThreads' },
    )

    expect(stderr).toContain(`Pool "vmThreads" cannot run with "experimental.viteModuleRunner: false". Please, use "threads" or "forks" instead.`)
  })

  test('can run tests in threads worker', async () => {
    const { stderr, testTree } = await runNoViteModuleRunnerTests(
      {
        'base1.test.js': `test('hello world', () => {})`,
        'base2.test.js': `test('hello world', () => {})`,
      },
      { pool: 'threads' },
    )

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
    const { stderr, testTree } = await runNoViteModuleRunnerTests(
      {
        'base1.test.js': `test('hello world', () => {})`,
        'base2.test.js': `test('hello world', () => {})`,
      },
      { pool: 'forks' },
    )

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
    const { stderr, testTree } = await runNoViteModuleRunnerTests({
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
    const { stderr, testTree } = await runNoViteModuleRunnerTests({
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
    const { stderr, testTree } = await runNoViteModuleRunnerTests(
      {
        'in-source.js': /* js */`
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
      },
      {
        includeSource: ['./in-source.js'],
      },
    )
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
    const { stderr, testTree } = await runNoViteModuleRunnerTests(
      {
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
      },
      {
        includeSource: ['./in-source.js'],
      },
    )
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
    const { stderr, testTree } = await runNoViteModuleRunnerTests(
      {
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
      },
      {
        includeSource: ['./in-source.js'],
      },
    )
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
    const { stderr, root } = await runNoViteModuleRunnerTests({
      'add.js': /* js */`
export function add(a, b) {
  return a + b
}
    `,
      'add.test.js': /* js */`
import { add } from './add' // [!] no extension
test('not reported')
    `,
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
    const { stderr, root } = await runNoViteModuleRunnerTests({
      'add.ts': /* ts */`
export function add(a: number, b: number): number {
  return a + b
}
    `,
      'add.test.js': /* js */`
import { add } from './add.js' // [!] JS extension is NOT valid
test('not reported')
    `,
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
    const { stderr, errorTree } = await runNoViteModuleRunnerTests(
      {
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
      },
      {
        includeTaskLocation: true,
        includeSource: ['./in-source.ts'],
      },
    )
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

  test('error in the sync mock factory is reported', async () => {
    const { stderr } = await runNoViteModuleRunnerTests({
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

  test('error in the async mock factory is reported', async () => {
    // async error is reported also as unhandled exception
    // I wasn't able to figure out what doesn't handle it properly
    // and assume it is something internal in Node.js
    // If it wasn't caught by us, we wouldn't have gotten the "suite" issue
    const { stderr } = await runNoViteModuleRunnerTests({
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
    })

    // "slice" removes the stack from unhandled error because it references built artifacts
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

  test('can load a custom environment', async () => {
    const { stderr, testTree } = await runNoViteModuleRunnerTests(
      {
        './env.js': /* js */`
export default {
  name: 'custom',
  viteEnvironment: 'client', // this is actually not used, but kept for consistency
  setup() {
    if (typeof __vite_ssr_import__ !== 'undefined') {
      throw new Error('expected no module runner')
    }
    globalThis.CUSTOM_ENV = true
    return {
      teardown() {
        delete globalThis.CUSTOM_ENV
      }
    }
  }
}
      `,
        'basic.test.js': /* js */ `
test('custom env is set', () => {
  expect(globalThis.CUSTOM_ENV).toBe(true)
})
      `,
      },
      {
        environment: './env.js',
      },
    )
    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "basic.test.js": {
          "custom env is set": "passed",
        },
      }
    `)
  })

  describe('.cts', () => {
    test('as esm is not supported', async () => {
      const { stderr } = await runNoViteModuleRunnerTests({
        'add.cts': /* ts */`
export function add(a: number, b: number): number {
  return a + b
}
      `,
        'add.test.cts': /* ts */`
import * as _ from './add.cts'
test('2+2=4', () => {
  expect(_.add(2, 2)).toBe(4)
})
`,
      })
      expect(stderr).toContain('Cannot use import statement outside a module')
    })

    test('by default with type stripping is not supported', async () => {
      const { stderr } = await runNoViteModuleRunnerTests({
        'add.cts': /* ts */`
export = function add(a: number, b: number): number {
  return a + b
}
      `,
        'add.test.cts': /* ts */`
import _ = require('./add.cts')
test('2+2=4', () => {
  expect(_.add(2, 2)).toBe(4)
})
`,
      })
      expect(stderr).toMatchInlineSnapshot(`
        "
        ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

         FAIL  add.test.cts [ add.test.cts ]
        SyntaxError: TypeScript import equals declaration is not supported in strip-only mode
        ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
        Serialized Error: { code: 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX' }
        ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

        "
      `)
    })

    test('with --experimental-transform-types is supported', async () => {
      const { errorTree } = await runNoViteModuleRunnerTests(
        {
          'add.cts': /* ts */`
export = function add(a: number, b: number): number {
  return a + b
}
      `,
          'add.test.mts': /* ts */`
import add from './add.cts'
test('2+2=4', () => {
  expect(add(2, 2)).toBe(4)
})
`,
        },
        {
          execArgv: ['--experimental-transform-types'],
        },
      )
      expect(errorTree()).toMatchInlineSnapshot(`
        {
          "add.test.mts": {
            "2+2=4": "passed",
          },
        }
      `)
    })
  })
})

describe.runIf(!module.registerHooks)('unsupported', () => {
  test('prints a warning if nodeLoader is not enabled', async () => {
    const { stderr } = await runNoViteModuleRunnerTests(
      { 'basic.test.js': `test('skip')` },
    )
    expect(stderr).toContain(`WARNING  "module.registerHooks" is not supported in Node.js ${process.version}. This means that some features like module mocking or in-source testing are not supported. Upgrade your Node.js version to at least 22.15 or disable "experimental.nodeLoader" flag manually.`)
  })
})

function runNoViteModuleRunnerTests(structure: TestFsStructure, vitestConfig?: RunVitestConfig, options?: VitestRunnerCLIOptions) {
  return runInlineTests(structure, {
    globals: true,
    ...vitestConfig,
    experimental: {
      ...vitestConfig?.experimental,
      viteModuleRunner: false,
    },
  }, options)
}

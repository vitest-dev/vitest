import { relative, resolve } from 'pathe'
import { glob } from 'tinyglobby'
import { describe, expect, it } from 'vitest'
import { rolldownVersion } from 'vitest/node'
import { runInlineTests, runVitest, ts } from '../../test-utils'

// To prevent the warning coming up in snapshots
process.setMaxListeners(20)

// Vite 7 points a call to an imported function at "(" instead of the callee
const callSiteFiles = [
  'error-in-deps.test.js',
  'error-in-package.test.js',
  'require-assertions.test.js',
]

describe('stacktraces should respect sourcemaps', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/stacktraces')
  const files = await glob(['*.test.*'], { cwd: root, expandDirectories: false })

  for (const file of files) {
    it.skipIf(!rolldownVersion && callSiteFiles.includes(file))(file, async () => {
      const { stderr } = await runVitest({ root }, [file])

      expect(stderr).toBeTruthy()
      const lines = String(stderr).split(/\n/g)
      const index = lines.findIndex((val) => val.includes(`${file}:`))
      const msg = lines.slice(index, index + 8).join('\n')
      expect(removeLines(msg)).toMatchSnapshot()
    })
  }
})

describe('stacktraces should pick error frame if present', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/stacktraces')
  const files = ['frame.spec.imba']

  for (const file of files) {
    it(file, async () => {
      const { stderr } = await runVitest({ root }, [file])

      expect(stderr).toBeTruthy()
      const lines = String(stderr).split(/\n/g)
      const index = lines.findIndex((val) => val.includes('FAIL'))
      const msg = lines.slice(index, index + 8).join('\n')
      expect(msg).toMatchSnapshot()
    })
  }
})

describe('stacktrace should print error frame source file correctly', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/stacktraces')
  const testFile = resolve(root, './error-in-deps.test.js')

  it.skipIf(!rolldownVersion)('error-in-deps', async () => {
    const { stderr } = await runVitest({ root }, [testFile])

    // expect to print framestack of foo.js
    expect(removeLines(stderr)).toMatchSnapshot()
  })
})

describe('stacktrace filtering', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/stacktraces')
  const testFile = resolve(root, './error-with-stack.test.js')

  it('filters stacktraces', async () => {
    const { stderr } = await runVitest(
      {
        root,
        onStackTrace: (_error, { method }) => method !== 'b',
      },
      [testFile],
    )

    expect(removeLines(stderr)).toMatchSnapshot()
  })
})

describe('stacktrace in dependency package', () => {
  const root = resolve(import.meta.dirname, '../fixtures/stacktraces')
  const testFile = resolve(root, './error-in-package.test.js')

  it.skipIf(!rolldownVersion)('external', async () => {
    const { stderr } = await runVitest(
      {
        root,
      },
      [testFile],
    )
    expect(removeNodeModules(removeLines(stderr))).toMatchSnapshot()
  })

  it.skipIf(!rolldownVersion)('inline', async () => {
    const { stderr } = await runVitest(
      {
        root,
        server: {
          deps: {
            inline: [/@test\/test-dep-error/],
          },
        },
      },
      [testFile],
    )
    expect(removeNodeModules(removeLines(stderr))).toMatchSnapshot()
  })

  it('uses the changed source map in the next run', async () => {
    const { ctx, fs, root, buildTree } = await runInlineTests(
      {
        'node_modules/dep/package.json': JSON.stringify({
          name: 'dep',
          type: 'module',
          exports: './index.js',
        }),
        'node_modules/dep/index.js': ts`
export function parse() {
  throw new Error('parse failed')
}
export function format() {
  throw new Error('format failed')
}
//# sourceMappingURL=index.js.map
`,
        'node_modules/dep/index.js.map': JSON.stringify({
          version: 3,
          sources: ['index.ts'],
          names: [],
          mappings: ';;AASA;;;AAUA',
        }),
        'basic.test.js': ts`
          import { format, parse } from 'dep'
          import { test } from 'vitest'

          let tries = 0
          test('flaky', { retry: 1 }, () => {
            if (tries++ === 0) {
              parse()
            }
            format()
          })
        `,
      },
      { watch: true },
    )
    const errorLocations = () =>
      buildTree((test) =>
        test.result().errors?.map((error) => {
          const [frame] = error.stacks || []
          return `${error.message} at ${relative(root, frame.file)}:${frame.line}:${frame.column}`
        }),
      )

    expect(errorLocations()).toMatchInlineSnapshot(`
      {
        "basic.test.js": {
          "flaky": [
            "parse failed at node_modules/dep/index.ts:10:1",
            "format failed at node_modules/dep/index.ts:20:1",
          ],
        },
      }
    `)

    fs.editFile('node_modules/dep/index.js.map', (map) => map.replace('index.ts', 'main.ts'))
    await ctx!.rerunTestSpecifications(
      ctx!.state.getTestModules().map((testModule) => testModule.toTestSpecification()),
    )

    expect(errorLocations()).toMatchInlineSnapshot(`
      {
        "basic.test.js": {
          "flaky": [
            "parse failed at node_modules/dep/main.ts:10:1",
            "format failed at node_modules/dep/main.ts:20:1",
          ],
        },
      }
    `)
  })
})

it('stacktrace in vmThreads', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/stacktraces')
  const testFile = resolve(root, './error-with-stack.test.js')
  const { stderr } = await runVitest(
    {
      root,
      pool: 'vmThreads',
    },
    [testFile],
  )

  expect(removeLines(stderr)).toMatchSnapshot()
})

function removeLines(log: string) {
  return log.replace(/⎯{2,}/g, '⎯⎯')
}

function removeNodeModules(log: string) {
  return log.replace(/[^ ]*\/node_modules\//g, '(NODE_MODULES)/')
}

it('custom helper with captureStackTrace', async () => {
  const { stderr, errorTree } = await runVitest({
    root: resolve(import.meta.dirname, '../fixtures/stacktraces-custom-helper'),
  })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > sync
    AssertionError: expected 3 to be 4 // Object.is equality

    - Expected
    + Received

    - 4
    + 3

     ❯ basic.test.ts:5:3
          3|
          4| test("sync", async () => {
          5|   assertHelper(3, 4);
           |   ^
          6| });
          7|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

     FAIL  basic.test.ts > async
    AssertionError: expected 3 to be 4 // Object.is equality

    - Expected
    + Received

    - 4
    + 3

     ❯ basic.test.ts:9:3
          7|
          8| test("async", async () => {
          9|   await assertHelperAsync(3, 4)
           |   ^
         10| })
         11|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

     FAIL  basic.test.ts > bad
    AssertionError: expected 3 to be 4 // Object.is equality

    - Expected
    + Received

    - 4
    + 3

     ❯ assertHelperBad helper.ts:23:20
         21|
         22| export function assertHelperBad(expected: any, actual: any) {
         23|   expect(expected).toBe(actual);
           |                    ^
         24| }
         25|
     ❯ basic.test.ts:13:3

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯

    "
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "async": [
          "expected 3 to be 4 // Object.is equality",
        ],
        "bad": [
          "expected 3 to be 4 // Object.is equality",
        ],
        "sync": [
          "expected 3 to be 4 // Object.is equality",
        ],
      },
    }
  `)
})

it('resolves/rejects', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'repro.test.ts': `
      import { test, expect } from 'vitest'

      test('resolves: resolved promise with mismatched value', async () => {
        await expect(Promise.resolve(3)).resolves.toBe(4)
      })

      test('rejects: rejected promise with mismatched value', async () => {
        await expect(Promise.reject(3)).rejects.toBe(4)
      })

      test('rejects: resolves when rejection expected', async () => {
        await expect(Promise.resolve(3)).rejects.toBe(4)
      })

      test('resolves: rejects when resolve expected', async () => {
        await expect(Promise.reject(3)).resolves.toBe(4)
      })
    `,
  })

  if (rolldownVersion) {
    expect(stderr).toMatchInlineSnapshot(`
      "
      ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

       FAIL  repro.test.ts > resolves: resolved promise with mismatched value
      AssertionError: expected 3 to be 4 // Object.is equality

      - Expected
      + Received

      - 4
      + 3

       ❯ repro.test.ts:5:41
            3|
            4|       test('resolves: resolved promise with mismatched value', async (…
            5|         await expect(Promise.resolve(3)).resolves.toBe(4)
             |                                         ^
            6|       })
            7|

      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

       FAIL  repro.test.ts > rejects: rejected promise with mismatched value
      AssertionError: expected 3 to be 4 // Object.is equality

      - Expected
      + Received

      - 4
      + 3

       ❯ repro.test.ts:9:40
            7|
            8|       test('rejects: rejected promise with mismatched value', async ()…
            9|         await expect(Promise.reject(3)).rejects.toBe(4)
             |                                        ^
           10|       })
           11|

      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

       FAIL  repro.test.ts > rejects: resolves when rejection expected
      AssertionError: promise resolved "3" instead of rejecting

      - Expected:
      Error {
        "message": "rejected promise",
      }

      + Received:
      3

       ❯ repro.test.ts:13:41
           11|
           12|       test('rejects: resolves when rejection expected', async () => {
           13|         await expect(Promise.resolve(3)).rejects.toBe(4)
             |                                         ^
           14|       })
           15|

      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

       FAIL  repro.test.ts > resolves: rejects when resolve expected
      AssertionError: promise rejected "3" instead of resolving
       ❯ repro.test.ts:17:40
           15|
           16|       test('resolves: rejects when resolve expected', async () => {
           17|         await expect(Promise.reject(3)).resolves.toBe(4)
             |                                        ^
           18|       })
           19|

      Caused by: 3
      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯

      "
    `)
  } else {
    expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  repro.test.ts > resolves: resolved promise with mismatched value
    AssertionError: expected 3 to be 4 // Object.is equality

    - Expected
    + Received

    - 4
    + 3

     ❯ repro.test.ts:5:40
          3|
          4|       test('resolves: resolved promise with mismatched value', async (…
          5|         await expect(Promise.resolve(3)).resolves.toBe(4)
           |                                        ^
          6|       })
          7|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

     FAIL  repro.test.ts > rejects: rejected promise with mismatched value
    AssertionError: expected 3 to be 4 // Object.is equality

    - Expected
    + Received

    - 4
    + 3

     ❯ repro.test.ts:9:39
          7|
          8|       test('rejects: rejected promise with mismatched value', async ()…
          9|         await expect(Promise.reject(3)).rejects.toBe(4)
           |                                       ^
         10|       })
         11|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

     FAIL  repro.test.ts > rejects: resolves when rejection expected
    AssertionError: promise resolved "3" instead of rejecting

    - Expected:
    Error {
      "message": "rejected promise",
    }

    + Received:
    3

     ❯ repro.test.ts:13:40
         11|
         12|       test('rejects: resolves when rejection expected', async () => {
         13|         await expect(Promise.resolve(3)).rejects.toBe(4)
           |                                        ^
         14|       })
         15|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

     FAIL  repro.test.ts > resolves: rejects when resolve expected
    AssertionError: promise rejected "3" instead of resolving
     ❯ repro.test.ts:17:39
         15|
         16|       test('resolves: rejects when resolve expected', async () => {
         17|         await expect(Promise.reject(3)).resolves.toBe(4)
           |                                       ^
         18|       })
         19|

    Caused by: 3
    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯

    "
  `)
  }
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "repro.test.ts": {
        "rejects: rejected promise with mismatched value": [
          "expected 3 to be 4 // Object.is equality",
        ],
        "rejects: resolves when rejection expected": [
          "promise resolved "3" instead of rejecting",
        ],
        "resolves: rejects when resolve expected": [
          "promise rejected "3" instead of resolving",
        ],
        "resolves: resolved promise with mismatched value": [
          "expected 3 to be 4 // Object.is equality",
        ],
      },
    }
  `)
})

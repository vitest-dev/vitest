import { resolve } from 'pathe'
import { glob } from 'tinyglobby'
import { describe, expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

// To prevent the warning coming up in snapshots
process.setMaxListeners(20)

describe('stacktraces should respect sourcemaps', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/stacktraces')
  const files = await glob(['*.test.*'], { cwd: root, expandDirectories: false })

  for (const file of files) {
    it(file, async () => {
      const { stderr } = await runVitest({ root }, [file])

      expect(stderr).toBeTruthy()
      const lines = String(stderr).split(/\n/g)
      const index = lines.findIndex(val => val.includes(`${file}:`))
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
      const index = lines.findIndex(val => val.includes('FAIL'))
      const msg = lines.slice(index, index + 8).join('\n')
      expect(msg).toMatchSnapshot()
    })
  }
})

describe('stacktrace should print error frame source file correctly', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/stacktraces')
  const testFile = resolve(root, './error-in-deps.test.js')

  it('error-in-deps', async () => {
    const { stderr } = await runVitest({ root }, [testFile])

    // expect to print framestack of foo.js
    expect(removeLines(stderr)).toMatchSnapshot()
  })
})

describe('stacktrace filtering', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/stacktraces')
  const testFile = resolve(root, './error-with-stack.test.js')

  it('filters stacktraces', async () => {
    const { stderr } = await runVitest({
      root,
      onStackTrace: (_error, { method }) => method !== 'b',
    }, [testFile])

    expect(removeLines(stderr)).toMatchSnapshot()
  })
})

describe('stacktrace in dependency package', () => {
  const root = resolve(import.meta.dirname, '../fixtures/stacktraces')
  const testFile = resolve(root, './error-in-package.test.js')

  it('external', async () => {
    const { stderr } = await runVitest({
      root,
    }, [testFile])
    expect(removeNodeModules(removeLines(stderr))).toMatchSnapshot()
  })

  it('inline', async () => {
    const { stderr } = await runVitest({
      root,
      server: {
        deps: {
          inline: [/@test\/test-dep-error/],
        },
      },
    }, [testFile])
    expect(removeNodeModules(removeLines(stderr))).toMatchSnapshot()
  })
})

it('stacktrace in vmThreads', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/stacktraces')
  const testFile = resolve(root, './error-with-stack.test.js')
  const { stderr } = await runVitest({
    root,
    pool: 'vmThreads',
  }, [testFile])

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

// TODO: test browser mode
it('assertion helper', async () => {
  const { stderr, errorTree } = await runVitest({
    root: resolve(import.meta.dirname, '../fixtures/stacktraces-helper'),
  })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > sync
    AssertionError: expected 'left' to deeply equal 'right'

    Expected: "right"
    Received: "left"

     ❯ basic.test.ts:22:3
         20| 
         21| test("sync", () => {
         22|   myEqual("left", "right");
           |   ^
         23| });
         24| 

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

     FAIL  basic.test.ts > async
    AssertionError: expected 'left' to deeply equal 'right'

    Expected: "right"
    Received: "left"

     ❯ basic.test.ts:26:3
         24| 
         25| test("async", async () => {
         26|   await myEqualAsync("left", "right");
           |   ^
         27| });
         28| 

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

     FAIL  basic.test.ts > soft
    AssertionError: expected 'left' to deeply equal 'right'

    Expected: "right"
    Received: "left"

     ❯ basic.test.ts:30:3
         28| 
         29| test("soft", () => {
         30|   myEqualSoft("left", "right");
           |   ^
         31| });
         32| 

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

     FAIL  basic.test.ts > soft async
    AssertionError: expected 'left' to deeply equal 'right'

    Expected: "right"
    Received: "left"

     ❯ basic.test.ts:34:3
         32| 
         33| test("soft async", async () => {
         34|   await myEqualSoftAsync("left", "right");
           |   ^
         35| });
         36| 

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯

    "
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "async": [
          "expected 'left' to deeply equal 'right'",
        ],
        "soft": [
          "expected 'left' to deeply equal 'right'",
        ],
        "soft async": [
          "expected 'left' to deeply equal 'right'",
        ],
        "sync": [
          "expected 'left' to deeply equal 'right'",
        ],
      },
    }
  `)
})

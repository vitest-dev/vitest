import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

// TODO: share with `extractTimelines` in test/browser/specs/trace-timeline.test.ts via test-utils
function extractTimelines(stderr: string) {
  return [...stderr.matchAll(/\nTrace\b.*?\n\n/gs)].map((match) => {
    const [title, ...lines] = match[0].trim().split('\n')
    const rows = lines.map((line) =>
      line
        .trim()
        .replace(/\d+ms\b/g, '<time>')
        .split(/ {2,}/),
    )
    const widths = rows[0].map((_, i) => Math.max(...rows.map((row) => row[i]?.length ?? 0)))
    const table = rows.map((row) =>
      row
        .map((cell, i) => cell.padEnd(widths[i]))
        .join('  ')
        .trimEnd(),
    )
    return [title, ...table].join('\n')
  })
}

test('prints expect.poll steps on failure', async () => {
  const { stderr, errorTree } = await runInlineTests(
    {
      'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'

      test('pass', async () => {
        await expect.poll(() => 1).toBe(1)
      })

      test('fail', async () => {
        let count = 0
        await expect.poll(() => ++count).toBeGreaterThan(2)
        await expect.poll(() => count).not.toBe(0)
        await expect.poll(() => count, { timeout: 100 }).toBe(10)
      })
    `,
    },
    {
      reporters: 'default',
      experimental: { traceTimeline: true },
    },
  )

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "fail": [
          "expected 3 to be 10 // Object.is equality",
        ],
        "pass": "passed",
      },
    }
  `)
  expect(extractTimelines(stderr)).toMatchInlineSnapshot(`
    [
      "Trace:
    step                             start    duration  location
    expect.poll().toBeGreaterThan()  +<time>  <time>    basic.test.ts:10:42
    expect.poll().not.toBe()         +<time>  <time>    basic.test.ts:11:44
    expect.poll().toBe()             +<time>  <time>    basic.test.ts:12:58",
    ]
  `)
})

test('prints vi.waitFor and vi.waitUntil steps on failure', async () => {
  const { stderr, errorTree } = await runInlineTests(
    {
      'basic.test.ts': /* ts */ `
      import { expect, test, vi } from 'vitest'

      test('fail after waits', async () => {
        let count = 0
        await vi.waitFor(() => expect(++count).toBeGreaterThan(2))
        await vi.waitUntil(() => ++count > 4)
        await expect.poll(() => count, { timeout: 100 }).toBe(10)
      })

      test('waitFor timeout', async () => {
        await vi.waitFor(() => expect(1).toBe(10), { timeout: 100 })
      })
    `,
    },
    {
      reporters: 'default',
      experimental: { traceTimeline: true },
    },
  )

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "fail after waits": [
          "expected 5 to be 10 // Object.is equality",
        ],
        "waitFor timeout": [
          "expected 1 to be 10 // Object.is equality",
        ],
      },
    }
  `)
  expect(extractTimelines(stderr)).toMatchInlineSnapshot(`
    [
      "Trace:
    step                  start    duration  location
    vi.waitFor()          +<time>  <time>    basic.test.ts:6:18
    vi.waitUntil()        +<time>  <time>    basic.test.ts:7:18
    expect.poll().toBe()  +<time>  <time>    basic.test.ts:8:58",
      "Trace:
    step          start    duration  location
    vi.waitFor()  +<time>  <time>    basic.test.ts:12:18",
    ]
  `)
})

test('names steps with message', async () => {
  const { stderr, errorTree } = await runInlineTests(
    {
      'basic.test.ts': /* ts */ `
      import { expect, test, vi } from 'vitest'

      test('fail', async () => {
        await vi.waitFor(() => {}, { message: 'server ready' })
        await vi.waitUntil(() => true, { message: 'user saved' })
        await expect.poll(() => 1, { timeout: 100, message: 'user indexed' }).toBe(10)
      })
    `,
    },
    {
      reporters: 'default',
      experimental: { traceTimeline: true },
    },
  )

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "fail": [
          "user indexed: expected 1 to be 10 // Object.is equality",
        ],
      },
    }
  `)
  expect(extractTimelines(stderr)).toMatchInlineSnapshot(`
    [
      "Trace:
    step                               start    duration  location
    server ready (vi.waitFor)          +<time>  <time>    basic.test.ts:5:18
    user saved (vi.waitUntil)          +<time>  <time>    basic.test.ts:6:18
    user indexed (expect.poll().toBe)  +<time>  <time>    basic.test.ts:7:79",
    ]
  `)
})

test('skips waits while tests run concurrently', async () => {
  const { stderr, errorTree } = await runInlineTests(
    {
      'basic.test.ts': /* ts */ `
      import { expect as globalExpect, test, vi } from 'vitest'

      test.concurrent('a', async ({ expect }) => {
        await vi.waitFor(() => {})
        await globalExpect.poll(() => 1).toBe(1)
        await expect.poll(() => 1, { timeout: 100 }).toBe(10)
      })

      test.concurrent('b', async ({ expect }) => {
        await vi.waitFor(() => {})
        await globalExpect.poll(() => 2).toBe(2)
        await expect.poll(() => 2, { timeout: 100 }).toBe(10)
      })
    `,
    },
    {
      reporters: 'default',
      experimental: { traceTimeline: true },
    },
  )

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "a": [
          "expected 1 to be 10 // Object.is equality",
        ],
        "b": [
          "expected 2 to be 10 // Object.is equality",
        ],
      },
    }
  `)
  expect(extractTimelines(stderr)).toMatchInlineSnapshot(`
    [
      "Trace:
    step                  start    duration  location
    expect.poll().toBe()  +<time>  <time>    basic.test.ts:7:54",
      "Trace:
    step                  start    duration  location
    expect.poll().toBe()  +<time>  <time>    basic.test.ts:13:54",
    ]
  `)
})

test('resolves locations like errors', async () => {
  const { stderr, errorTree } = await runInlineTests(
    {
      'helper.ts': /* ts */ `
      import { expect, vi } from 'vitest'

      export async function waitForCount(getCount: () => number) {
        await expect.poll(getCount, { timeout: 100 }).toBe(10)
      }

      export const waitForCountHelper = vi.defineHelper(async (getCount: () => number) => {
        await expect.poll(getCount).toBe(1)
        await expect.poll(getCount, { timeout: 100 }).toBe(10)
      })
    `,
      'basic.test.ts': /* ts */ `
      import { test } from 'vitest'
      import { waitForCount, waitForCountHelper } from './helper'

      test('helper file', async () => {
        await waitForCount(() => 1)
      })

      test('defineHelper', async () => {
        await waitForCountHelper(() => 1)
      })
    `,
    },
    {
      reporters: 'default',
      experimental: { traceTimeline: true },
    },
  )

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "defineHelper": [
          "expected 1 to be 10 // Object.is equality",
        ],
        "helper file": [
          "expected 1 to be 10 // Object.is equality",
        ],
      },
    }
  `)
  // defineHelper steps point at the call site `await waitForCountHelper(...)`: the first at
  // column 15 (`waitForCountHelper`), the second at column 9 (`await`) since it runs after an
  // `await` inside the helper
  expect(extractTimelines(stderr)).toMatchInlineSnapshot(`
    [
      "Trace:
    step                  start    duration  location
    expect.poll().toBe()  +<time>  <time>    helper.ts:5:55",
      "Trace:
    step                  start    duration  location
    expect.poll().toBe()  +<time>  <time>    basic.test.ts:10:15
    expect.poll().toBe()  +<time>  <time>    basic.test.ts:10:9",
    ]
  `)
})

test('prints the timeline of each failed attempt', async () => {
  const { stderr, errorTree } = await runInlineTests(
    {
      'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'

      test('fail', { retry: 1 }, async ({ task }) => {
        await expect.poll(() => task.result.retryCount, { timeout: 100 }).toBe(10)
      })
    `,
    },
    {
      reporters: 'default',
      experimental: { traceTimeline: true },
    },
  )

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "fail": [
          "expected +0 to be 10 // Object.is equality",
          "expected 1 to be 10 // Object.is equality",
        ],
      },
    }
  `)
  expect(extractTimelines(stderr)).toMatchInlineSnapshot(`
    [
      "Trace:
    step                  start    duration  location
    expect.poll().toBe()  +<time>  <time>    basic.test.ts:5:75",
      "Trace (retry 1):
    step                  start    duration  location
    expect.poll().toBe()  +<time>  <time>    basic.test.ts:5:75",
    ]
  `)
})

test('prints the timelines of the replay seed and its replay', async () => {
  const { stderr } = await runInlineTests(
    {
      'queue.test.ts': /* ts */ `
      import { expect, test } from 'vitest'

      test('drains the queue', { repeats: 1 }, async ({ random }) => {
        const pending = random.int(0, 3)
        await expect.poll(() => pending).toBeGreaterThanOrEqual(0)
        await expect.poll(() => pending, { timeout: 50 }).toBeLessThan(2)
      })
    `,
    },
    {
      reporters: 'default',
      experimental: { traceTimeline: true },
    },
  )

  expect(extractTimelines(stderr)).toMatchInlineSnapshot(`
    [
      "Trace:
    step                                    start    duration  location
    expect.poll().toBeGreaterThanOrEqual()  +<time>  <time>    queue.test.ts:6:42
    expect.poll().toBeLessThan()            +<time>  <time>    queue.test.ts:7:59",
      "Trace (replay of initial run):
    step                                    start    duration  location
    expect.poll().toBeGreaterThanOrEqual()  +<time>  <time>    queue.test.ts:6:42
    expect.poll().toBeLessThan()            +<time>  <time>    queue.test.ts:7:59",
    ]
  `)
})

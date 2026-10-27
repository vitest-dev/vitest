import type { TestFsStructure } from '../../test-utils'
import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

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

async function run(structure: TestFsStructure, traceTimeline = true) {
  return runInlineTests(structure, {
    reporters: 'default',
    experimental: { traceTimeline },
  })
}

test('prints expect.poll steps on failure', async () => {
  const { stderr } = await run({
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
  })

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
  const { stderr } = await run({
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
  })

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

test('skips waits while tests run concurrently', async () => {
  const { stderr } = await run({
    'basic.test.ts': /* ts */ `
      import { expect, test, vi } from 'vitest'

      test.concurrent('a', async ({ expect }) => {
        await vi.waitFor(() => {})
        await expect.poll(() => 1, { timeout: 100 }).toBe(10)
      })

      test.concurrent('b', async ({ expect }) => {
        await vi.waitFor(() => {})
        await expect.poll(() => 2, { timeout: 100 }).toBe(10)
      })
    `,
  })

  expect(extractTimelines(stderr)).toMatchInlineSnapshot(`
    [
      "Trace:
    step                  start    duration  location
    expect.poll().toBe()  +<time>  <time>    basic.test.ts:6:54",
      "Trace:
    step                  start    duration  location
    expect.poll().toBe()  +<time>  <time>    basic.test.ts:11:54",
    ]
  `)
})

test('resolves locations like errors', async () => {
  const { stderr } = await run({
    'helper.ts': /* ts */ `
      import { expect } from 'vitest'

      export async function waitForCount(getCount: () => number) {
        await expect.poll(getCount, { timeout: 100 }).toBe(10)
      }
    `,
    'basic.test.ts': /* ts */ `
      import { expect, test, vi } from 'vitest'
      import { waitForCount } from './helper'

      const waitForCountHelper = vi.defineHelper(async (getCount: () => number) => {
        await expect.poll(getCount).toBe(1)
        await expect.poll(getCount, { timeout: 100 }).toBe(10)
      })

      test('helper file', async () => {
        await waitForCount(() => 1)
      })

      test('defineHelper', async () => {
        await waitForCountHelper(() => 1)
      })
    `,
  })

  expect(extractTimelines(stderr)).toMatchInlineSnapshot(`
    [
      "Trace:
    step                  start    duration  location
    expect.poll().toBe()  +<time>  <time>    helper.ts:5:55",
      "Trace:
    step                  start    duration  location
    expect.poll().toBe()  +<time>  <time>    basic.test.ts:15:15
    expect.poll().toBe()  +<time>  <time>    basic.test.ts:15:9",
    ]
  `)
})

test('prints the timeline of each failed attempt', async () => {
  const { stderr } = await run({
    'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'

      test('fail', { retry: 1 }, async ({ task }) => {
        await expect.poll(() => task.result.retryCount, { timeout: 100 }).toBe(10)
      })
    `,
  })

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

test('records trace only for failed attempts', async () => {
  const { ctx, stderr } = await run({
    'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'

      test('pass', async () => {
        await expect.poll(() => 1).toBe(1)
      })

      test('pass on retry', { retry: 1 }, async ({ task }) => {
        await expect.poll(() => task.result.retryCount, { timeout: 100 }).toBe(1)
      })
    `,
  })

  expect(stderr).toBe('')
  const artifacts = Object.fromEntries(
    [...ctx!.state.getTestModules()[0].children.allTests()].map((testCase) => [
      testCase.name,
      testCase.artifacts().map((artifact) => {
        const data = artifact.data as { retry: number; entries: { name: string }[] }
        return { retry: data.retry, entries: data.entries.map((entry) => entry.name) }
      }),
    ]),
  )
  expect(artifacts).toMatchInlineSnapshot(`
    {
      "pass": [],
      "pass on retry": [
        {
          "entries": [
            "expect.poll().toBe()",
            "expect.poll().toBe()",
          ],
          "retry": 0,
        },
      ],
    }
  `)
})

test('prints nothing without the option', async () => {
  const { stderr, errorTree } = await run(
    {
      'basic.test.ts': /* ts */ `
        import { expect, test } from 'vitest'

        test('fail', async () => {
          await expect.poll(() => 1, { timeout: 100 }).toBe(10)
        })
      `,
    },
    false,
  )

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "fail": [
          "expected 1 to be 10 // Object.is equality",
        ],
      },
    }
  `)
  expect(extractTimelines(stderr)).toEqual([])
})

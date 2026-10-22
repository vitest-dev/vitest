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

test('prints the last attempt of a retried test', async () => {
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
      "Trace (retry 1):
    step                  start    duration  location
    expect.poll().toBe()  +<time>  <time>    basic.test.ts:5:75",
      "Trace (retry 1):
    step                  start    duration  location
    expect.poll().toBe()  +<time>  <time>    basic.test.ts:5:75",
    ]
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

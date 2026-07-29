---
title: Waiting for Async Conditions | Recipes
---

# Waiting for Async Conditions

Plenty of things in tests don't happen synchronously. A server takes a moment to boot, or a DOM element renders after a microtask. Waiting with `setTimeout` tends to land on either a flaky undershoot or a wasteful long sleep, and a manual polling loop is more code than you want to write per test.

Vitest provides helpers that poll on your behalf, retrying on a fixed interval until the condition holds or a timeout elapses.

## `expect.poll`: retry an assertion

Use [`expect.poll`](/api/expect#poll) when the wait condition is an assertion. The callback returns the value to assert on, the matcher does the comparison, and Vitest retries the whole expression at each interval until the matcher passes.

```ts
import { expect, test } from 'vitest'
import { createServer } from './server.ts'

test('server starts', async () => {
  const server = createServer()

  await expect.poll(() => server.isReady, {
    timeout: 500,
    interval: 20
  }).toBe(true)
})
```

The failure message is the standard `expect` diff, with no manual `throw new Error('Server not started')` to maintain. This is the right tool for most "wait for X to become Y" cases.

`expect.poll` makes every assertion asynchronous, so the call must be awaited. Some matchers don't pair with it: snapshot matchers (which would always succeed under polling), `.resolves` and `.rejects` (the condition is already awaited), and `toThrow` (the value is resolved before the matcher sees it). For any of those, reach for `vi.waitFor` instead.

## `vi.waitFor`: wait and capture the value

[`vi.waitFor`](/api/vi#vi-waitfor) is the right tool when the wait condition is the work itself succeeding rather than an assertion you write. It runs the callback at each interval; a thrown error queues another attempt, and the first call that doesn't throw resolves the wait with whatever the callback returned.

```ts
import { expect, test, vi } from 'vitest'
import { connect, DB_URL } from './db.ts'

test('database is reachable', async () => {
  // `connect` throws ECONNREFUSED until the database accepts connections
  const client = await vi.waitFor(() => connect(DB_URL), {
    timeout: 5000,
    interval: 100,
  })

  const rows = await client.query('SELECT 1 AS ok')
  expect(rows[0].ok).toBe(1)
})
```

The throw that drives the retry comes from `connect` itself, not from an `expect` you wrote inside the callback. `expect.poll` doesn't fit this shape because it's built around assertions, and "retry until this call stops throwing and hand me the result" isn't an assertion. Wrapping the call in a `try`/`catch` to fake one would either duplicate the work after the wait or require building the retry loop by hand.

## `vi.waitUntil`: poll until truthy, fail fast on errors

Use [`vi.waitUntil`](/api/vi#vi-waituntil) for a value lookup where any thrown error should fail the test on the spot rather than be retried away. Each interval calls the callback again. A truthy return resolves the wait; a falsy return waits for the next interval. A thrown error fails the test immediately.

```ts
import { expect, test, vi } from 'vitest'
import { jobResults, startJob } from './worker.ts'

test('worker completes the job', async () => {
  startJob('build-42')

  const result = await vi.waitUntil(
    () => jobResults.get('build-42'),
    { timeout: 5000, interval: 100 },
  )

  expect(result.status).toBe('ok')
  expect(result.steps).toHaveLength(4)
})
```

`jobResults.get('build-42')` returns `JobResult | undefined`. `waitUntil` polls until it returns a truthy value, narrows the resolved type to `JobResult`, and hands it back for further assertions. If the lookup itself throws because of a programming error like a typo in the import, `waitUntil` surfaces the error on the first attempt rather than retrying past it.

In browser mode, prefer [`page.locator`](/api/browser/locators) and [`expect.element`](/api/browser/assertions) over `waitUntil` for DOM queries: locators retry on their own and produce richer failure messages.

## Picking between them

|  | `expect.poll` | `vi.waitFor` | `vi.waitUntil` |
| --- | --- | --- | --- |
| Reach for it when | the wait is an assertion | the work might fail until it's ready | a lookup might be falsy and that's fine |
| Retries on thrown error | yes | yes | no, fails fast |
| Resolves with | the assertion | callback's return value | callback's return value |

Each of these accepts `{ timeout, interval }` options, defaulting to a 1000 ms timeout and 50 ms intervals. `vi.waitFor` and `vi.waitUntil` also accept a number in place of the options object as shorthand for the timeout.

## Fake timers

If [`vi.useFakeTimers`](/api/vi#vi-usefaketimers) is active, `vi.waitFor` automatically calls `vi.advanceTimersByTime(interval)` between attempts. That keeps `setTimeout`-based code under test reachable without leaking real time into the test.

## See also

- [`expect.poll`](/api/expect#poll)
- [`vi.waitFor`](/api/vi#vi-waitfor)
- [`vi.waitUntil`](/api/vi#vi-waituntil)
- [`vi.useFakeTimers`](/api/vi#vi-usefaketimers)

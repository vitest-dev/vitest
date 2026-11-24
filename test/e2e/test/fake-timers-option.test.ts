import type { TestCase, TestModule } from 'vitest/node'
import { expect, test } from 'vitest'
import { runInlineTests } from '#test-utils'

// the inline snapshots have the seeds of the run seed 0
function runSeededTests(...[structure, config, ...rest]: Parameters<typeof runInlineTests>) {
  return runInlineTests(structure, { seed: 0, ...config }, ...rest)
}

function findTest(modules: TestModule[], name: string): TestCase {
  const testCase = modules
    .flatMap((module) => [...module.children.allTests()])
    .find((testCase) => testCase.fullName === name)
  if (!testCase) {
    throw new Error(`The test "${name}" was not found.`)
  }
  return testCase
}

// the empty first and last lines put the quotes of an inline snapshot on their own lines
function seedLines(stderr: string): string {
  const lines = stderr
    .split('\n')
    .filter((line) => /^ FAIL |^ +(Failed|Reproduced|Original|Values|Keep|Tape) {2}/.test(line))
  return lines.length ? `\n${lines.join('\n')}\n` : ''
}

declare module 'vitest' {
  interface TaskMeta {
    starts?: string[]
    values?: number[]
  }
}

test('a test with the option has fake timers, and the next test has real timers', async () => {
  const { stderr, testTree } = await runInlineTests({
    'search.test.js': /* js */ `
      import { expect, test, vi } from 'vitest'

      function debounce(fn, delay) {
        let timer
        return () => {
          clearTimeout(timer)
          timer = setTimeout(fn, delay)
        }
      }

      const beats = []

      test('a debounced search runs 1 time', { fakeTimers: true }, () => {
        const search = vi.fn()
        const debounced = debounce(search, 300)
        debounced()
        debounced()
        vi.advanceTimersByTime(300)
        expect(search).toHaveBeenCalledTimes(1)
        // stays pending when the test ends
        setInterval(() => beats.push(Date.now()), 100)
      })

      test('real timers after the test', async () => {
        expect(vi.isFakeTimers()).toBe(false)
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      test('the interval of the first test is gone', { fakeTimers: true }, () => {
        vi.advanceTimersByTime(1000)
        expect(beats).toEqual([])
      })
    `,
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "search.test.js": {
        "a debounced search runs 1 time": "passed",
        "real timers after the test": "passed",
        "the interval of the first test is gone": "passed",
      },
    }
  `)
})

test('each repeat gets a new clock at the real time, also if the test moves the time', async () => {
  const before = Date.now()
  const { stderr, results } = await runInlineTests({
    'trial.test.js': /* js */ `
      import { expect, test, vi } from 'vitest'

      const DAY = 24 * 60 * 60 * 1000

      test('the trial ends after 30 days', { repeats: 2, fakeTimers: true }, ({ task }) => {
        expect(vi.isFakeTimers()).toBe(true)
        task.meta.starts = [...(task.meta.starts ?? []), new Date().toISOString()]
        const end = Date.now() + 30 * DAY
        vi.advanceTimersByTime(30 * DAY)
        expect(Date.now()).toBe(end)
        // the next repeat has fake timers again
        vi.useRealTimers()
      })
    `,
  })
  expect(stderr).toBe('')
  const starts = findTest(results, 'the trial ends after 30 days').meta().starts ?? []
  expect(starts).toHaveLength(3)
  for (const start of starts) {
    expect(Date.parse(start)).toBeGreaterThanOrEqual(before)
    expect(Date.parse(start)).toBeLessThanOrEqual(Date.now())
  }
})

const renewalTests = /* js */ `
import { expect, test } from 'vitest'

function addMonth(date) {
  const next = new Date(date)
  next.setUTCMonth(next.getUTCMonth() + 1)
  return next
}

const fakeTimers = {
  now: { min: new Date('2024-01-01T00:00:00.000Z'), max: new Date('2025-12-31T23:59:59.999Z') },
}

test('a subscription renews in the next month', { repeats: 49, fakeTimers }, () => {
  const start = new Date()
  expect(addMonth(start).getUTCMonth(), start.toISOString()).toBe((start.getUTCMonth() + 1) % 12)
})
`

test('a now range starts each repeat at a date from the seed, the search shows the smallest date, and the replay repeats it', async () => {
  const name = 'a subscription renews in the next month'
  const { stderr, results } = await runSeededTests(
    { 'renewal.test.js': renewalTests },
    { shrink: true },
  )
  const failed = findTest(results, name)
    .attempts()
    .filter((attempt) => attempt.state === 'failed')
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    "
     FAIL  renewal.test.js > a subscription renews in the next month
         Failed  3 of 50 runs
       Original  AssertionError: 2024-03-31T14:37:40.585Z: expected 4 to be 3 // Object.is equality
         Values  fakeTimers.now → 2024-01-30T00:00:00.000Z
           Keep  seeds: ['881dc20cb715ec35:AQECDnZpdGVzdDpnbG9iYWxzDHZpdGVzdDpjbG9jawgGAAAAAAD0ve_7Dg']
    "
  `)
  expect(failed.map((attempt) => attempt.errors[0].message)).toMatchInlineSnapshot(`
    [
      "2024-01-30T00:00:00.000Z: expected 2 to be 1 // Object.is equality",
      "2024-01-30T00:00:00.000Z: expected 2 to be 1 // Object.is equality",
      "2024-08-31T16:53:33.440Z: expected 9 to be 8 // Object.is equality",
      "2024-08-31T16:53:33.440Z: expected 9 to be 8 // Object.is equality",
      "2025-01-30T04:58:18.127Z: expected 2 to be 1 // Object.is equality",
      "2025-01-30T04:58:18.127Z: expected 2 to be 1 // Object.is equality",
    ]
  `)

  // a later repeat starts at the same date when only its seed runs
  const last = failed.findLast((attempt) => !attempt.shrink)
  const replay = await runSeededTests(
    { 'renewal.test.js': renewalTests },
    { $cliOptions: { replaySeed: last?.seed, shrink: false } },
  )
  expect(findTest(replay.results, name).result().errors?.[0].message).toBe(last?.errors[0].message)

  const searched = failed.find((attempt) => attempt.shrink)
  expect(searched?.shrink).toMatchObject({ shrunk: true, reproduced: true })
  const smallest = await runSeededTests(
    { 'renewal.test.js': renewalTests },
    { $cliOptions: { replaySeed: `${searched?.seed}:${searched?.shrink?.tape}` } },
  )
  expect(seedLines(smallest.stderr)).toMatchInlineSnapshot(`
    "
     FAIL  renewal.test.js > a subscription renews in the next month
    "
  `)
  expect(findTest(smallest.results, name).result().errors?.[0].message).toBe(
    failed[0].errors[0].message,
  )
})

test('the each hooks and the fixtures of the test see the fake clock, and the all hooks see the real time', async () => {
  const { stderr, testTree } = await runInlineTests({
    'invoice.test.js': /* js */ `
      import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, onTestFinished, test as base, vi } from 'vitest'

      const leapDay = '2024-02-29T12:00:00.000Z'

      const test = base.extend({
        customer: async ({}, use) => {
          expect(new Date().toISOString()).toBe(leapDay)
          await use({ name: 'Ada' })
          expect(vi.isFakeTimers()).toBe(true)
        },
      })

      describe('invoices', { fakeTimers: { now: new Date(leapDay) } }, () => {
        beforeAll(() => {
          expect(vi.isFakeTimers()).toBe(false)
        })

        test.aroundEach(async (runTest, { customer }) => {
          expect(new Date().toISOString()).toBe(leapDay)
          await runTest()
          expect(vi.isFakeTimers()).toBe(true)
        })

        beforeEach(() => {
          expect(new Date().toISOString()).toBe(leapDay)
        })

        afterEach(() => {
          expect(vi.isFakeTimers()).toBe(true)
        })

        afterAll(() => {
          expect(vi.isFakeTimers()).toBe(false)
        })

        test('an invoice of a leap day is due in March', () => {
          onTestFinished(() => {
            expect(vi.isFakeTimers()).toBe(true)
          })
          const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          expect(due.toISOString()).toBe('2024-03-30T12:00:00.000Z')
        })
      })
    `,
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "invoice.test.js": {
        "invoices": {
          "an invoice of a leap day is due in March": "passed",
        },
      },
    }
  `)
})

test('a tag gives its tests the same dates and random values in every pool', async () => {
  const files = {
    'order.test.js': /* js */ `
      import { test } from 'vitest'

      test('creates an order', { tags: 'simulation' }, ({ task }) => {
        task.meta.starts = [...(task.meta.starts ?? []), new Date().toISOString()]
        task.meta.values = [...(task.meta.values ?? []), Math.random()]
      })
    `,
    'vitest.config.js': /* js */ `
      export default {
        test: {
          seed: 0,
          tags: [
            {
              name: 'simulation',
              repeats: 2,
              fakeRandom: true,
              fakeTimers: {
                now: { min: new Date('2024-06-01T00:00:00.000Z'), max: new Date('2024-06-30T23:59:59.999Z') },
              },
            },
          ],
        },
      }
    `,
  }
  const metas: Record<string, unknown> = {}
  for (const pool of ['threads', 'forks', 'vmThreads', 'vmForks'] as const) {
    const { stderr, results } = await runInlineTests(files, { $cliOptions: { pool } })
    expect.soft(stderr, pool).toBe('')
    const { starts, values } = findTest(results, 'creates an order').meta()
    metas[pool] = { starts, values }
  }
  expect(metas.threads).toMatchInlineSnapshot(`
    {
      "starts": [
        "2024-06-21T16:50:44.610Z",
        "2024-06-29T13:59:19.146Z",
        "2024-06-28T10:03:13.242Z",
      ],
      "values": [
        0.3997501911248682,
        0.2968401098018466,
        0.22895508222714545,
      ],
    }
  `)
  expect(Object.values(metas)).toEqual([metas.threads, metas.threads, metas.threads, metas.threads])
})

test('fixtures of file and worker scope start before the fake clock', async () => {
  const { stderr, testTree } = await runInlineTests({
    'server.test.js': /* js */ `
      import { beforeEach, expect, test as base, vi } from 'vitest'

      function createService() {
        const service = { fake: vi.isFakeTimers(), beats: 0 }
        const interval = setInterval(() => service.beats++, 5)
        return { service, stop: () => clearInterval(interval) }
      }

      const test = base.extend({
        server: [async ({}, use) => {
          const { service, stop } = createService()
          await use(service)
          stop()
        }, { scope: 'file' }],
        queue: [async ({}, use) => {
          const { service, stop } = createService()
          await use(service)
          stop()
        }, { scope: 'file' }],
        database: [async ({}, use) => {
          const { service, stop } = createService()
          await use(service)
          stop()
        }, { scope: 'worker' }],
        session: async ({}, use) => {
          await use({ fake: vi.isFakeTimers() })
        },
      })

      beforeEach(({ database }) => {
        expect(database.fake).toBe(false)
      })

      test.aroundEach(async (runTest, { queue }) => {
        expect(queue.fake).toBe(false)
        await runTest()
      })

      test('the request reaches the server', { fakeTimers: true }, ({ server, session }) => {
        expect(server.fake).toBe(false)
        expect(session.fake).toBe(true)
      })

      test('the services still run after the test', async ({ server, database, queue }) => {
        await expect.poll(() => server.beats).toBeGreaterThan(0)
        await expect.poll(() => database.beats).toBeGreaterThan(0)
        await expect.poll(() => queue.beats).toBeGreaterThan(0)
      })
    `,
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "server.test.js": {
        "the request reaches the server": "passed",
        "the services still run after the test": "passed",
      },
    }
  `)
})

test('a hook that throws does not keep the clock', async () => {
  const { errorTree } = await runInlineTests({
    'report.test.js': /* js */ `
      import { expect, onTestFinished, test, vi } from 'vitest'

      test('closes the report', { fakeTimers: true }, () => {
        onTestFinished(() => {
          throw new Error('The report is locked.')
        })
      })

      test('real timers after the test', () => {
        expect(vi.isFakeTimers()).toBe(false)
      })
    `,
  })
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "report.test.js": {
        "closes the report": [
          "The report is locked.",
        ],
        "real timers after the test": "passed",
      },
    }
  `)
})

test('a test with the option fails 1 time without its hooks if the timers are already fake, and the clock stays', async () => {
  const { errorTree, results } = await runInlineTests({
    'report.test.js': /* js */ `
      import { afterAll, afterEach, aroundEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

      const calls = []

      describe('with the clock of the suite', () => {
        beforeAll(() => {
          vi.useFakeTimers({ now: new Date('2020-01-01T00:00:00.000Z') })
        })

        afterAll(() => {
          vi.useRealTimers()
        })

        aroundEach(async (runTest, { task }) => {
          calls.push('aroundEach: ' + task.name)
          await runTest()
        })

        beforeEach(({ task }) => {
          calls.push('beforeEach: ' + task.name)
        })

        afterEach(({ task }) => {
          calls.push('afterEach: ' + task.name)
        })

        test('schedules a report', () => {
          setInterval(() => {}, 1000)
          expect(vi.getTimerCount()).toBe(1)
        })

        const leapDay = { now: new Date('2024-02-29T00:00:00.000Z') }

        test('creates the report of a leap day', { fakeTimers: leapDay, retry: 2, repeats: 2 }, () => {
          calls.push('test: creates the report of a leap day')
        })

        test.fails('rejects the report of a leap day', { fakeTimers: leapDay }, () => {
          throw new Error('The report is locked.')
        })

        test('has the clock of the suite after the failed tests', () => {
          expect(new Date().toISOString()).toBe('2020-01-01T00:00:00.000Z')
          expect(vi.getTimerCount()).toBe(1)
          expect(calls).toEqual([
            'aroundEach: schedules a report',
            'beforeEach: schedules a report',
            'afterEach: schedules a report',
            'aroundEach: has the clock of the suite after the failed tests',
            'beforeEach: has the clock of the suite after the failed tests',
          ])
        })
      })
    `,
  })
  const attempts = findTest(
    results,
    'with the clock of the suite > creates the report of a leap day',
  ).attempts()
  expect(attempts.map(({ state }) => state)).toEqual(['failed'])
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "report.test.js": {
        "with the clock of the suite": {
          "creates the report of a leap day": [
            "The "fakeTimers" option cannot be used in the test "with the clock of the suite > creates the report of a leap day", because the timers are already fake. Call \`vi.useRealTimers()\` before the test, or remove the option.",
          ],
          "has the clock of the suite after the failed tests": "passed",
          "rejects the report of a leap day": [
            "The "fakeTimers" option cannot be used in the test "with the clock of the suite > rejects the report of a leap day", because the timers are already fake. Call \`vi.useRealTimers()\` before the test, or remove the option.",
          ],
          "schedules a report": "passed",
        },
      },
    }
  `)
})

test('a fixture of file scope that throws before the fake clock fails the test 1 time without its hooks', async () => {
  const { errorTree, results } = await runInlineTests({
    'server.test.js': /* js */ `
      import { afterEach, beforeEach, expect, test as base } from 'vitest'

      const calls = []

      const test = base.extend({
        server: [async () => {
          calls.push('server')
          throw new Error('The port is in use.')
        }, { scope: 'file' }],
      })

      test.aroundEach(async (runTest) => {
        calls.push('aroundEach')
        await runTest()
      })

      beforeEach(() => {
        calls.push('beforeEach')
      })

      afterEach(() => {
        calls.push('afterEach')
      })

      test('the request reaches the server', { fakeTimers: true, retry: 2, repeats: 2 }, ({ server }) => {
        calls.push('test')
      })

      test('only the next test ran', () => {
        expect(calls).toEqual(['server', 'aroundEach', 'beforeEach'])
      })
    `,
  })
  const attempts = findTest(results, 'the request reaches the server').attempts()
  expect(attempts.map(({ state }) => state)).toEqual(['failed'])
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "server.test.js": {
        "only the next test ran": "passed",
        "the request reaches the server": [
          "The port is in use.",
        ],
      },
    }
  `)
})

test('each retry and each repeat gets a new clock, also in aroundEach', async () => {
  const { stderr, results } = await runInlineTests({
    'trial.test.js': /* js */ `
      import { test, vi } from 'vitest'

      const DAY = 24 * 60 * 60 * 1000
      const leapDay = new Date('2024-02-29T00:00:00.000Z')
      let runs = 0

      test.aroundEach(async (runTest, { task }) => {
        task.meta.starts = [...(task.meta.starts ?? []), new Date().toISOString()]
        vi.advanceTimersByTime(30 * DAY)
        await runTest()
        vi.advanceTimersByTime(30 * DAY)
      })

      test('the trial ends after 30 days', { repeats: 1, retry: 1, fakeTimers: { now: leapDay } }, () => {
        runs++
        // the first try of each repeat fails
        if (runs % 2 === 1) {
          throw new Error('The trial did not end.')
        }
      })
    `,
  })
  expect(stderr).toBe('')
  const testCase = findTest(results, 'the trial ends after 30 days')
  expect(testCase.attempts().map(({ state }) => state)).toEqual([
    'failed',
    'passed',
    'failed',
    'passed',
  ])
  expect(testCase.meta().starts).toEqual(
    Array.from({ length: 4 }, () => '2024-02-29T00:00:00.000Z'),
  )
})

test('an aroundEach hook that throws or times out does not keep the fakes', async () => {
  const { errorTree } = await runInlineTests({
    'orders.test.js': /* js */ `
      import { aroundEach, describe, expect, test, vi } from 'vitest'

      describe('a hook that throws', () => {
        aroundEach(async (runTest) => {
          await runTest()
          throw new Error('The transaction was not rolled back.')
        })

        test('saves an order', { fakeRandom: true, fakeTimers: true }, () => {})
      })

      describe('a hook that times out', () => {
        aroundEach(async () => {
          await new Promise(() => {})
        }, 100)

        test('cancels an order', { fakeRandom: true, fakeTimers: true }, () => {})
      })

      test('has the real functions after the hooks', () => {
        expect(vi.isFakeTimers()).toBe(false)
        expect(vi.isFakeRandom()).toBe(false)
      })
    `,
  })
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "orders.test.js": {
        "a hook that throws": {
          "saves an order": [
            "The transaction was not rolled back.",
          ],
        },
        "a hook that times out": {
          "cancels an order": [
            "The setup phase of "aroundEach" hook timed out after 100ms.",
          ],
        },
        "has the real functions after the hooks": "passed",
      },
    }
  `)
})

test('a fixture of aroundEach and the test, an auto fixture and nested aroundEach hooks get the fakes', async () => {
  const { stderr, testTree } = await runInlineTests({
    'invoice.test.js': /* js */ `
      import { aroundEach, describe, expect, test as base, vi } from 'vitest'

      const leapDay = '2024-02-29T12:00:00.000Z'
      const expectFakes = () => {
        expect(new Date().toISOString()).toBe(leapDay)
        expect(vi.isFakeRandom()).toBe(true)
      }
      let customers = 0
      let customerOfHook

      const test = base.extend({
        customer: async ({}, use) => {
          expectFakes()
          customers++
          await use({ id: crypto.randomUUID() })
          expectFakes()
        },
        audit: [async ({}, use) => {
          expectFakes()
          await use()
          expectFakes()
        }, { auto: true }],
      })

      aroundEach(async (runTest, { task }) => {
        expectFakes()
        await runTest()
        expectFakes()
      })

      describe('invoices', () => {
        test.aroundEach(async (runTest, { customer }) => {
          expectFakes()
          customerOfHook = customer
          await runTest()
          expectFakes()
        })

        test('an invoice of a leap day', {
          fakeRandom: true,
          fakeTimers: { now: new Date(leapDay) },
        }, ({ customer }) => {
          expectFakes()
          expect(customer).toBe(customerOfHook)
          expect(customers).toBe(1)
        })
      })
    `,
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "invoice.test.js": {
        "invoices": {
          "an invoice of a leap day": "passed",
        },
      },
    }
  `)
})

test('fakeTimers: false turns off the option of the suite for a test', async () => {
  const { stderr, testTree } = await runInlineTests({
    'upload.test.js': /* js */ `
      import { describe, expect, test, vi } from 'vitest'

      describe('uploads', { fakeTimers: true }, () => {
        test('retries after 5 seconds', () => {
          const retry = vi.fn()
          setTimeout(retry, 5000)
          vi.advanceTimersByTime(5000)
          expect(retry).toHaveBeenCalledTimes(1)
        })

        test('waits for the server', { fakeTimers: false }, async () => {
          expect(vi.isFakeTimers()).toBe(false)
          await new Promise(resolve => setTimeout(resolve, 10))
        })
      })
    `,
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "upload.test.js": {
        "uploads": {
          "retries after 5 seconds": "passed",
          "waits for the server": "passed",
        },
      },
    }
  `)
})

test('the options throw for concurrent tests when the file is collected', async () => {
  const collect = async (code: string, config?: Parameters<typeof runInlineTests>[1]) => {
    const { stderr } = await runInlineTests(
      { 'queue.test.js': `import { describe, test } from 'vitest'\n${code}` },
      config,
    )
    return stderr.split('\n').find((line) => line.includes('Error: ')) ?? ''
  }

  expect(
    await collect(`test.concurrent('sends a message', { fakeTimers: true }, () => {})`),
  ).toMatchInlineSnapshot(
    `"Error: The "fakeTimers" option cannot be used in the concurrent test "sends a message", because tests that run at the same time share 1 clock. Set \`concurrent: false\` on the test and on its suites."`,
  )
  expect(
    await collect(`
      describe.concurrent('queue', () => {
        test('sends a message', { concurrent: false, fakeTimers: true }, () => {})
      })
    `),
  ).toMatchInlineSnapshot(
    `"Error: The "fakeTimers" option cannot be used in the concurrent test "queue > sends a message", because tests that run at the same time share 1 clock. Set \`concurrent: false\` on the test and on its suites."`,
  )
  expect(
    await collect(`test('sends a message', { fakeRandom: true }, () => {})`, {
      sequence: { concurrent: true },
    }),
  ).toMatchInlineSnapshot(
    `"Error: The "fakeRandom" option cannot be used in the concurrent test "sends a message", because tests that run at the same time share the random functions. Use \`context.random\` instead, or set \`concurrent: false\` on the test and on its suites."`,
  )
  // a test that is not concurrent runs alone
  expect(
    await collect(
      `test('sends a message', { concurrent: false, fakeTimers: true, fakeRandom: true }, () => {})`,
      { sequence: { concurrent: true } },
    ),
  ).toBe('')
  expect(
    await collect(
      `test.concurrent('sends a message', { fakeRandom: false, fakeTimers: false }, () => {})`,
    ),
  ).toBe('')
})

test('invalid options throw, and vi.useFakeTimers() rejects a now range', async () => {
  const run = async (code: string) => {
    const { stderr } = await runInlineTests({
      'clock.test.js': `import { test, vi } from 'vitest'\n${code}`,
    })
    return stderr.split('\n').find((line) => line.includes('Error: ')) ?? ''
  }

  expect(await run(`test('ticks', { fakeTimers: 'yes' }, () => {})`)).toMatchInlineSnapshot(
    `"TypeError: The "fakeTimers" option of a test must be a boolean or an object with the options of fake timers, received "yes"."`,
  )
  expect(await run(`test('ticks', { fakeRandom: 1 }, () => {})`)).toMatchInlineSnapshot(
    `"TypeError: The "fakeRandom" option of a test must be a boolean, received 1."`,
  )
  expect(
    await run(`test('ticks', { fakeTimers: { now: { min: new Date('2025-01-01') } } }, () => {})`),
  ).toMatchInlineSnapshot(
    `"TypeError: The "now" range of fake timers must have a "min" and a "max" time, received {"min":"2025-01-01T00:00:00.000Z"}."`,
  )
  expect(
    await run(`
      test('ticks', () => {
        vi.useFakeTimers({ now: { min: new Date('2024-01-01'), max: new Date('2025-01-01') } })
      })
    `),
  ).toMatchInlineSnapshot(
    `"TypeError: A \`now\` range takes the time from the seed of a test, so it works only in the \`fakeTimers\` option of a test: \`test(name, { fakeTimers: { now: { min, max } } }, fn)\`."`,
  )
})

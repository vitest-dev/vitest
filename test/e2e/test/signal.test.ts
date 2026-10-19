import type { UserConsoleLog } from 'vitest'
import type { Reporter, TestCase, Vitest } from 'vitest/node'
import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('timeout aborts the signal without fixtures', async () => {
  const { stderr, results } = await runInlineTests({
    'basic.test.ts': /* ts */ `
      import { test } from 'vitest'
      import { setTimeout } from 'node:timers/promises'
      test('timeouts', async ({ signal, task, example }) => {
        signal.addEventListener('abort', () => {
          task.meta.aborted = true
        })
        await setTimeout(100)
      }, 10)
    `,
  })
  expect(stderr).toContain('Test timed out in 10ms.')
  expect(results).toHaveLength(1)
  expect(results[0].children.at(0)?.meta()).toEqual({
    aborted: true,
  })
})

test('timeout aborts the signal', async () => {
  const { stderr, results } = await runInlineTests({
    'basic.test.ts': /* ts */ `
      import { test } from 'vitest'
      import { setTimeout } from 'node:timers/promises'
      test.extend({
        // .extend to force fixture initialisation
        example: true,
      })('timeouts', async ({ signal, task, example }) => {
        signal.addEventListener('abort', () => {
          task.meta.aborted = true
        })
        await setTimeout(100)
      }, 10)
    `,
  })
  expect(stderr).toContain('Test timed out in 10ms.')
  expect(results).toHaveLength(1)
  expect(results[0].children.at(0)?.meta()).toEqual({
    aborted: true,
  })
})

test('timeout aborts all signals in concurrent tests', async () => {
  const { stderr, results } = await runInlineTests({
    'basic.test.ts': /* ts */ `
      import { test } from 'vitest'
      import { setTimeout } from 'node:timers/promises'
      test
        // .extend to force fixture initialisation
        .extend({ example: true })
        .concurrent
        .for([1, 1, 1])
      ('timeouts', async (_, { signal, task, example }) => {
        signal.addEventListener('abort', () => {
          task.meta.aborted = true
        })
        await setTimeout(100)
      }, 10)
    `,
  })
  expect(stderr).toContain('Test timed out in 10ms.')
  expect(results).toHaveLength(1)
  expect(results[0].children.at(0)?.meta()).toEqual({
    aborted: true,
  })
  expect(results[0].children.at(1)?.meta()).toEqual({
    aborted: true,
  })
  expect(results[0].children.at(2)?.meta()).toEqual({
    aborted: true,
  })
})

class AbortReporter implements Reporter {
  vitest!: Vitest
  onInit(vitest: Vitest) {
    this.vitest = vitest
  }

  onUserConsoleLog(log: UserConsoleLog) {
    if (log.content.includes('ready')) {
      this.vitest.cancelCurrentRun('keyboard-input')
    }
  }
}

test('cancelling test run aborts the signal', async () => {
  const { results, stderr } = await runInlineTests(
    {
      'basic.test.ts': /* ts */ `
      import { test } from 'vitest'
      test('aborted', async ({ signal, task }) => {
        return new Promise(resolve => {
          signal.addEventListener('abort', () => {
            task.meta.aborted = true
            resolve()
          })
          console.log('ready')
        })
      }, Infinity)
    `,
    },
    {
      reporters: ['default', new AbortReporter()],
    },
  )
  expect(stderr).toBe('')
  expect(results).toHaveLength(1)
  expect(results[0].children.at(0)?.meta()).toEqual({
    aborted: true,
  })
})

test('cancelling test run aborts the signal in all concurrent tests', async () => {
  const { results, stderr } = await runInlineTests(
    {
      'basic.test.ts': /* ts */ `
      import { test } from 'vitest'
      test.concurrent.for([1, 2, 3])(
        'aborted',
        { timeout: Infinity },
         async (number, { signal, task }) => {
          return new Promise(resolve => {
            signal.addEventListener('abort', () => {
              task.meta.aborted = true
              resolve()
            })
            if (number === 3) {
              console.log('ready')
            }
          })
        })
    `,
    },
    {
      reporters: ['default', new AbortReporter()],
    },
  )
  expect(stderr).toBe('')
  expect(results).toHaveLength(1)
  expect(results[0].children.at(0)?.meta()).toEqual({
    aborted: true,
  })
  expect(results[0].children.at(1)?.meta()).toEqual({
    aborted: true,
  })
  expect(results[0].children.at(2)?.meta()).toEqual({
    aborted: true,
  })
})

class CancelOnTestResultReporter implements Reporter {
  vitest!: Vitest
  constructor(private testName: string) {}

  onInit(vitest: Vitest) {
    this.vitest = vitest
  }

  onTestCaseResult(testCase: TestCase) {
    if (testCase.name === this.testName) {
      this.vitest.cancelCurrentRun('keyboard-input')
    }
  }
}

test('cancelling test run aborts the signal after a concurrent test finished', async () => {
  const { errorTree, stderr } = await runInlineTests(
    {
      'basic.test.ts': /* ts */ `
      import { test } from 'vitest'
      test.concurrent('passes', () => {})
      test.concurrent('aborted', { timeout: 1000 }, ({ signal }) => {
        return new Promise(resolve => signal.addEventListener('abort', resolve))
      })
    `,
    },
    {
      reporters: ['default', new CancelOnTestResultReporter('passes')],
    },
  )
  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "aborted": "skipped",
        "passes": "passed",
      },
    }
  `)
})

test('bail aborts the signal of concurrent tests that started after the failed one', async () => {
  const { errorTree } = await runInlineTests(
    {
      'basic.test.ts': /* ts */ `
      import { beforeEach, describe, test } from 'vitest'

      test.concurrent('fails', () => {
        throw new Error('test fails')
      })

      describe.concurrent('aborted', () => {
        beforeEach(async ({ signal }) => {
          await new Promise(resolve => signal.addEventListener('abort', resolve))
          signal.throwIfAborted()
        }, 1000)

        test('skipped', () => {})
      })
    `,
    },
    { bail: 1 },
  )
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "aborted": {
          "skipped": "skipped",
        },
        "fails": [
          "test fails",
        ],
      },
    }
  `)
})

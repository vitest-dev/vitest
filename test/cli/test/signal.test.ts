import type { UserConsoleLog } from 'vitest'
import type { Reporter, Vitest } from 'vitest/node'
import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('timeout aborts the signal without fixtures', async () => {
  const { stderr, results } = await runInlineTests({
    'basic.test.ts': /* ts */`
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
    'basic.test.ts': /* ts */`
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
    'basic.test.ts': /* ts */`
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
  const { results, stderr } = await runInlineTests({
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
  }, {
    reporters: [
      'default',
      new AbortReporter(),
    ],
  })
  expect(stderr).toBe('')
  expect(results).toHaveLength(1)
  expect(results[0].children.at(0)?.meta()).toEqual({
    aborted: true,
  })
})

test('cancelling test run aborts the signal in all concurrent tests', async () => {
  const { results, stderr } = await runInlineTests({
    'basic.test.ts': /* ts */`
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
  }, {
    reporters: [
      'default',
      new AbortReporter(),
    ],
  })
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

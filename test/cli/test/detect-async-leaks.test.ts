import { expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

test('should detect hanging operations', async () => {
  let { stdout, stderr } = await runVitestCli(
    'run',
    '--root',
    'fixtures/detect-async-leaks',
    '--detectAsyncLeaks',
  )

  expect(stderr).toBeFalsy()
  expect(stdout).toBeTruthy()
  expect(stdout).contain('⎯⎯⎯⎯⎯ Hanging Operations ⎯⎯⎯⎯⎯')
  expect(stdout).contain('Vitest has detected the following 12 hanging operations potentially keeping Vitest from exiting:')

  stdout = stdout.replaceAll(process.cwd(), '')

  const intervals = [
    `Timeout | setInterval.test.ts
    at /fixtures/detect-async-leaks/setInterval.test.ts:4:3`,

    `Timeout | setInterval.test.ts > suite 1 > suite 2 > hanging ops 2
    at /fixtures/detect-async-leaks/setInterval.test.ts:18:7`,

    `Timeout | setInterval.test.ts > suite 1 > hanging ops 1
    at /fixtures/detect-async-leaks/setInterval.test.ts:13:5`,

    `Timeout | setInterval.test.ts
    at /fixtures/detect-async-leaks/setInterval.test.ts:8:3`,
  ]

  intervals.forEach(interval => expect(stdout).toContain(interval))

  const timeouts = [
    `Timeout | timeout.test.ts
    at /fixtures/detect-async-leaks/timeout.test.ts:4:3`,

    `Timeout | timeout.test.ts > suite 1 > suite 2 > hanging ops 2
    at /fixtures/detect-async-leaks/timeout.test.ts:18:7`,

    `Timeout | timeout.test.ts > suite 1 > hanging ops 1
    at /fixtures/detect-async-leaks/timeout.test.ts:13:5`,

    `Timeout | timeout.test.ts
    at /fixtures/detect-async-leaks/timeout.test.ts:8:3`,
  ]

  timeouts.forEach(timeout => expect(stdout).toContain(timeout))

  const promises = [
    `PROMISE | promise.test.ts
    at /fixtures/detect-async-leaks/promise.test.ts:4:3`,

    `PROMISE | promise.test.ts > suite 1 > suite 2 > hanging ops 2
    at /fixtures/detect-async-leaks/promise.test.ts:18:7`,

    `PROMISE | promise.test.ts > suite 1 > hanging ops 1
    at /fixtures/detect-async-leaks/promise.test.ts:13:5`,

    `PROMISE | promise.test.ts
    at /fixtures/detect-async-leaks/promise.test.ts:8:3`,
  ]

  promises.forEach(promise => expect(stdout).toContain(promise))
})

import { expect, test, vi } from 'vitest'
import { runVitest } from '../../test-utils'

test('default intercept', async () => {
  const { stderr } = await runVitest({
    root: './fixtures/console',
  })
  expect(stderr).toBe('stderr | basic.test.ts > basic\n__test_console__\n\n')
})

test.each(['threads', 'vmThreads'] as const)(`disable intercept pool=%s`, async (pool) => {
  // `disableConsoleIntercept: true` forwards workers console.error to main thread's stderr
  const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

  await runVitest({
    root: './fixtures/console',
    disableConsoleIntercept: true,
    pool,
  })

  const call = spy.mock.lastCall![0]
  expect(call.toString()).toBe('__test_console__\n')
})

test('group synchronous console logs', async () => {
  const { stdout } = await runVitest({
    root: './fixtures/console-batch',
  })
  const logs = stdout
    .split('\n')
    .filter(row => row.length === 0 || row.startsWith('stdout | ') || row.startsWith('__TEST__'))
    .join('\n')
    .trim()
  expect(logs).toMatchInlineSnapshot(`
    "stdout | basic.test.ts
    __TEST__ [beforeAll 1]

    stdout | basic.test.ts
    __TEST__ [beforeAll 2]

    stdout | basic.test.ts > test
    __TEST__ [beforeEach 1]

    stdout | basic.test.ts > test
    __TEST__ [beforeEach 2]

    stdout | basic.test.ts > test
    __TEST__ [test 1]
    __TEST__ [test 2]

    stdout | basic.test.ts > test
    __TEST__ [test 3]
    __TEST__ [test 4]

    stdout | basic.test.ts > test
    __TEST__ [afterEach 2]

    stdout | basic.test.ts > test
    __TEST__ [afterEach 1]

    stdout | basic.test.ts
    __TEST__ [afterAll 2]

    stdout | basic.test.ts
    __TEST__ [afterAll 1]"
  `)
})

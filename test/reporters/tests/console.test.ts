import type { Reporter } from 'vitest/reporters'
import { resolve } from 'pathe'
import { expect, test, type UserConsoleLog } from 'vitest'
import { DefaultReporter } from 'vitest/reporters'
import { runVitest } from '../../test-utils'

class LogReporter extends DefaultReporter {
  isTTY = true
  onTaskUpdate() {}
}

test('should print logs correctly', async () => {
  const filename = resolve('./fixtures/console.test.ts')

  const { stdout, stderr } = await runVitest({
    root: './fixtures',
    reporters: [new LogReporter() as any],
  }, [filename])

  expect(stdout).toBeTruthy()
  expect(stderr).toBeTruthy()

  expect(stdout).toContain(
    `stdout | console.test.ts
global stdin beforeAll

stdout | console.test.ts > suite
suite stdin beforeAll

stdout | console.test.ts > suite > nested suite
nested suite stdin beforeAll`,
  )

  expect(stdout).toContain(
    `stdout | console.test.ts > suite > nested suite
nested suite stdin afterAll

stdout | console.test.ts > suite
suite stdin afterAll

stdout | console.test.ts
global stdin afterAll`,
  )

  expect(stderr).toContain(
    `stderr | console.test.ts
global stderr beforeAll

stderr | console.test.ts > suite
suite stderr beforeAll

stderr | console.test.ts > suite > nested suite
nested suite stderr beforeAll

stderr | console.test.ts > suite > nested suite
nested suite stderr afterAll

stderr | console.test.ts > suite
suite stderr afterAll

stderr | console.test.ts
global stderr afterAll`,
  )
})

test.for(['forks', 'threads'])('interleave (pool = %s)', async (pool) => {
  const logs: UserConsoleLog[] = []
  const { stderr } = await runVitest({
    root: './fixtures',
    pool,
    reporters: [
      {
        onUserConsoleLog(log) {
          logs.push(log)
        },
      } satisfies Reporter,
    ],
  }, [resolve('./fixtures/console-interleave.test.ts')])
  expect(stderr).toBe('')
  expect(logs).toMatchObject([
    {
      type: 'stdout',
      content: expect.stringContaining('1'),
    },
    {
      type: 'stderr',
      content: expect.stringContaining('2'),
    },
    {
      type: 'stdout',
      content: expect.stringContaining('3'),
    },
  ])
})

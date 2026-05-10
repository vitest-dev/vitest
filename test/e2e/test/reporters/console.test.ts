import type { UserConsoleLog } from 'vitest'
import type { Reporter } from 'vitest/node'
import { runVitest } from '#test-utils'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { DefaultReporter } from 'vitest/node'

class LogReporter extends DefaultReporter {
  isTTY = true
}

test('should print logs correctly', async () => {
  const filename = resolve('./fixtures/reporters/console.test.ts')

  const { stdout, stderr } = await runVitest({
    root: './fixtures/reporters',
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
    root: './fixtures/reporters',
    pool,
    reporters: [
      {
        onUserConsoleLog(log) {
          logs.push(log)
        },
      } satisfies Reporter,
    ],
  }, [resolve('./fixtures/reporters/console-interleave.test.ts')])
  expect(stderr).toBe('')
  const formatted = logs.map((log, i) =>
    ({
      type: log.type,
      content: log.content.trim(),
      timeSign: i > 0 ? Math.sign(log.time - logs[i - 1].time) : undefined,
    }))
  expect(formatted).toMatchInlineSnapshot(`
    [
      {
        "content": "1",
        "timeSign": undefined,
        "type": "stdout",
      },
      {
        "content": "2",
        "timeSign": 1,
        "type": "stderr",
      },
      {
        "content": "3",
        "timeSign": 1,
        "type": "stdout",
      },
    ]
  `)
})

test('console batching', async () => {
  const logs: UserConsoleLog[] = []
  const { stderr } = await runVitest({
    root: './fixtures/reporters/console-batch',
    reporters: [
      {
        onUserConsoleLog(log) {
          logs.push(log)
        },
      } satisfies Reporter,
    ],
  })
  expect(stderr).toBe('')
  const formatted = logs.map((log, i) =>
    ({
      type: log.type,
      content: log.content.replace(/\n/g, '_'),
      timeSign: i > 0 ? Math.sign(log.time - logs[i - 1].time) : undefined,
    }))
  expect(formatted).toMatchInlineSnapshot(`
    [
      {
        "content": "1_",
        "timeSign": undefined,
        "type": "stdout",
      },
      {
        "content": "2_4_",
        "timeSign": 1,
        "type": "stdout",
      },
      {
        "content": "3_",
        "timeSign": 1,
        "type": "stderr",
      },
    ]
  `)
})

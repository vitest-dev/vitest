import { expect, test } from 'vitest'
import { DefaultReporter } from 'vitest/node'
import { runVitest } from '../../test-utils'

test('{ silent: true } hides all console logs', async () => {
  const { stdout } = await runVitest({
    include: ['./fixtures/console-some-failing.test.ts'],
    silent: true,
    reporters: [new LogReporter()],
  })

  expect(stdout).not.toContain('stdout')
  expect(stdout).not.toContain('Log from')
  expect(stdout).toContain('Test Files  1 failed | 1 passed')
})

test('default value of silence shows all console logs', async () => {
  const { stdout } = await runVitest({
    include: ['./fixtures/console-some-failing.test.ts'],
    reporters: [new LogReporter()],
  })

  expect(stdout.match(/stdout/g)).toHaveLength(8)

  expect(stdout).toContain(`\
stdout | fixtures/console-some-failing.test.ts
Log from failed file

stdout | fixtures/console-some-failing.test.ts > passed test #1
Log from passed test

stdout | fixtures/console-some-failing.test.ts > failed test #1
Log from failed test

stdout | fixtures/console-some-failing.test.ts > failed suite #1
Log from failed suite

stdout | fixtures/console-some-failing.test.ts > failed suite #1 > passed test #2
Log from passed test

stdout | fixtures/console-some-failing.test.ts > failed suite #1 > failed test #2
Log from failed test

stdout | fixtures/console-some-failing.test.ts > passed suite #2
Log from passed suite

stdout | fixtures/console-some-failing.test.ts > passed suite #2 > passed test #3
Log from passed test`,
  )
})

test('{ silent: "passed-only" } shows all console logs from failed tests only', async () => {
  const { stdout } = await runVitest({
    include: ['./fixtures/console-some-failing.test.ts'],
    silent: 'passed-only',
    reporters: [new LogReporter()],
  })

  expect(stdout).toContain(`\
stdout | fixtures/console-some-failing.test.ts > failed test #1
Log from failed test

stdout | fixtures/console-some-failing.test.ts > failed suite #1 > failed test #2
Log from failed test

stdout | fixtures/console-some-failing.test.ts > failed suite #1
Log from failed suite

stdout | fixtures/console-some-failing.test.ts
Log from failed file`,
  )

  expect(stdout).not.toContain('Log from passed')
  expect(stdout.match(/stdout/g)).toHaveLength(4)
})

test('{ silent: "passed-only" } logs are filtered by custom onConsoleLog', async () => {
  const { stdout } = await runVitest({
    include: ['./fixtures/console-some-failing.test.ts'],
    silent: 'passed-only',
    onConsoleLog(log) {
      if (log.includes('suite')) {
        return true
      }

      return false
    },
    reporters: [new LogReporter()],
  })

  expect(stdout).toContain(`\
stdout | fixtures/console-some-failing.test.ts > failed suite #1
Log from failed suite`,
  )

  expect(stdout).not.toContain('Log from passed')
  expect(stdout).not.toContain('Log from failed test')
  expect(stdout).not.toContain('Log from failed file')
  expect(stdout.match(/stdout/g)).toHaveLength(1)
})

class LogReporter extends DefaultReporter {
  isTTY = true
}

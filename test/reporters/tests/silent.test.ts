import { expect, test } from 'vitest'
import { DefaultReporter } from 'vitest/reporters'
import { runVitest } from '../../test-utils'

test('{ silent: true } hides all console logs', async () => {
  const { stdout } = await runVitest({
    include: ['./fixtures/console-some-failing.test.ts'],
    silent: true,
    reporters: [new LogReporter()],
  })

  expect(stdout).not.toContain('stdout')
  expect(stdout).toContain('Test Files  1 failed | 1 passed')
})

test('default value of silence shows all console logs', async () => {
  const { stdout } = await runVitest({
    include: ['./fixtures/console-some-failing.test.ts'],
    reporters: [new LogReporter()],
  })

  expect(stdout).toContain(`\
stdout | fixtures/console-some-failing.test.ts
Log from failed file

stdout | fixtures/console-some-failing.test.ts > passing test #1
Log from passed test

stdout | fixtures/console-some-failing.test.ts > failing test #1
Log from failed test

stdout | fixtures/console-some-failing.test.ts > failing suite > passing test #2
Log from passed test

stdout | fixtures/console-some-failing.test.ts > failing suite > failing test #2
Log from failed test`,
  )
})

test('{ silent: "silent-passed-tests" } shows all console logs from failed tests only', async () => {
  const { stdout } = await runVitest({
    include: ['./fixtures/console-some-failing.test.ts'],
    silent: 'silent-passed-tests',
    reporters: [new LogReporter()],
  })

  expect(stdout).not.toContain('Log from passed test')

  expect(stdout).toContain(`\
stdout | fixtures/console-some-failing.test.ts > failing test #1
Log from failed test

stdout | fixtures/console-some-failing.test.ts > failing suite > failing test #2
Log from failed test

stdout | fixtures/console-some-failing.test.ts
Log from failed file`,
  )
})

class LogReporter extends DefaultReporter {
  isTTY = true
  onTaskUpdate() {}
}

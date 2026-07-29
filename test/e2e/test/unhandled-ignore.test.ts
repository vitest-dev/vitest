import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('run mode does not get stuck when TTY', async () => {
  const { vitest } = await runVitest({
    root: './fixtures/fails',
    include: ['unhandled.test.ts'],
    onUnhandledError(err) {
      if (err.message === 'some error') {
        return false
      }
    },
    // jsdom also prints a warning, but we don't care for our use case
    onConsoleLog() {
      return false
    },
  })

  // Regression #3642
  expect(vitest.stderr).toBe('')
})

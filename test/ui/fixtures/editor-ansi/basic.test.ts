import { test } from 'vitest'

test('test-with-ansi-message', () => {
  throw new Error('\x1B[32mExpected value\x1B[39m but got \x1B[31mactual value\x1B[39m')
})

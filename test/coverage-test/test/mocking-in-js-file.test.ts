import { expect } from 'vitest'
import { runVitest, test } from '../utils'

test('mocking in JS test file should not crash source map lookup (#3514)', async () => {
  const { exitCode } = await runVitest({
    include: ['fixtures/test/mocking-in-js-file.test.js'],
    coverage: {
      reporter: 'json',
      all: false,
    },
  })

  expect(exitCode).toBe(0)
})

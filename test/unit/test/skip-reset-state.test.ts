import { getCurrentTest } from '@vitest/runner'
import { afterAll, expect, test } from 'vitest'

afterAll(() => {
  // verify "current test" resets after "skip"
  expect(getCurrentTest()).toBeUndefined()
})

test('single skipped test', ({ skip }) => {
  skip()
})

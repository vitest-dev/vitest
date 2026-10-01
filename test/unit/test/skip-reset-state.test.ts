import { afterAll, expect, test, TestRunner } from 'vitest'

afterAll(() => {
  // verify "current test" resets after "skip"
  expect(TestRunner.getCurrentTest()).toBeUndefined()
})

test('single skipped test', ({ skip }) => {
  skip()
})

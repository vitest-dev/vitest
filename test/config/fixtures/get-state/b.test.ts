import { expect, test } from 'vitest'

const testPath = expect.getState().testPath;

test("b", () => {
  expect(testPath).toContain('b.test.ts')
})

import { expect, test } from 'vitest'

const testPath = expect.getState().testPath;

test("a", () => {
  expect(testPath).toContain('a.test.ts')
})

import { expect, test } from 'vitest'

const testPath = expect.getState().testPath;

test("c", () => {
  expect(testPath).toContain('c.test.ts')
})

import { expect, test } from "vitest"

test('', async () => {
  expect(() => {
    throw new Error('hi')
  }).not.toThrowErrorMatchingInlineSnapshot(`[Error: hi]`)
})

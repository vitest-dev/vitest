import { expect, test } from "vitest"

test.each([
  'toMatchSnapshot',
  'toMatchFileSnapshot',
  'toMatchInlineSnapshot',
  'toThrowErrorMatchingSnapshot',
  'toThrowErrorMatchingInlineSnapshot',
])('%s should fail with not', (api) => {
  (expect(0).not as any)[api]()
})

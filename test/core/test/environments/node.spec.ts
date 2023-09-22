// @vitest-environment node

import { expect, test } from 'vitest'

test('url correctly creates an object', () => {
  expect(() => {
    URL.createObjectURL(new Blob([]))
  }).not.toThrow()
})

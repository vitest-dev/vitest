import { expect, test } from 'vitest'

test('window is undefined', () => {
  expect(globalThis.window).toBeUndefined()
})

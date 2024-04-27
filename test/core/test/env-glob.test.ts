import { expect, test } from 'vitest'

test('default', () => {
  expect(typeof window).toBe('undefined')
  expect(expect.getState().environment).toBe('node')
})

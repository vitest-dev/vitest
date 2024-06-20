import { expect, test } from 'vitest'

test('glob on extension', () => {
  expect(typeof window).not.toBe('undefined')
  expect(expect.getState().environment).toBe('happy-dom')
})

import { expect, test } from 'vitest'

test('glob on folder', () => {
  expect(typeof window).not.toBe('undefined')
  expect(expect.getState().environment).toBe('jsdom')
})

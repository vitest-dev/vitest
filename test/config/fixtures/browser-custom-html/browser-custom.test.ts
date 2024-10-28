import { test, expect } from 'vitest';

test('custom', () => {
  expect(window).toHaveProperty('CUSTOM_INJECTED', true)
})

test('importmap is injected', () => {
  expect(import.meta.resolve('some-lib')).toBe('https://vitest.dev/some-lib')
})

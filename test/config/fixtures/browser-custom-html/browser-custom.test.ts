import { test, expect } from 'vitest';

test('custom', () => {
  expect(window).toHaveProperty('CUSTOM_INJECTED', true)
})

import { test, expect } from 'vitest';
import condition from './dependency';

test('condition is correct', () => {
  expect(condition).toBe(TEST_CONDITION)
})

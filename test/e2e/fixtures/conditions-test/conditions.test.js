import { test, expect } from 'vitest';
import { condition } from '../conditions-pkg';

test('condition is correct', () => {
  expect(condition).toBe(TEST_CONDITION)
})

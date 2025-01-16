import { test, expect } from 'vitest';
import condition from '@vitest/test-dep-conditions';

test('condition is correct', () => {
  expect(condition).toBe('module')
})

import { test, expect } from 'vitest';
import repro from 'virtual:repro';

test('importing a virtual module', () => {
  expect(repro).toBe('Hello, world!');
});

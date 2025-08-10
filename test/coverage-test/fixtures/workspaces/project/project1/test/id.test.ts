import { expect, test } from 'vitest';
import { id } from '../src/id';

test('returns identity value', () => {
  expect(id(1)).toBe(1);
})

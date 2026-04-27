import { expect, it } from 'vitest';

it('foo', () => {
  expect(1).toBe(1)
  new Promise((resolve, reject) => {
    reject('promise error');
  });
});

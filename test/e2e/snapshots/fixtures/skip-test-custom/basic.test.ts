import { expect, test } from 'vitest';

test('custom a', () => {
  expect(0).toMatchSnapshot('x');
  expect(0).toMatchSnapshot('y');
});

test('custom b', () => {
  expect(0).toMatchSnapshot('z');
  expect(0).toMatchSnapshot('w');
});

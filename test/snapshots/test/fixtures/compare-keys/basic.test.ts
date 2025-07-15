import { test, expect } from 'vitest';

test('compareKeys', () => {
  expect({
    a: 1,
    b: 2,
    c: 3,
  }).toMatchSnapshot();

  expect({
    c: 1,
    b: 2,
    a: 3,
  }).toMatchSnapshot();

  expect({
    b: 1,
    a: 2,
    c: 3,
  }).toMatchSnapshot();
});

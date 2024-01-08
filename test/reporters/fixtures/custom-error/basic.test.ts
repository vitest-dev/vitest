import { test } from 'vitest';

test('no name object', () => {
  throw { noName: 'hi' };
});

test('string', () => {
  throw "hi";
});

test('number', () => {
  throw 1234;
});

test('number name object', () => {
  throw { name: 1234 };
});

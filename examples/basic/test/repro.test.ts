import { beforeEach, it } from "vitest";

beforeEach(() => {
  console.log('beforeEach-in');
  return async () => {
    console.log('beforeEach-out');
    await new Promise(() => {});
  };
});

it('foo', () => {
  console.log('test');
});

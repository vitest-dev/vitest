import { beforeEach } from 'vitest';

export type MyContext = {
  testOk: boolean
}

beforeEach<MyContext>((ctx) => {
  ctx.testOk = true;
});

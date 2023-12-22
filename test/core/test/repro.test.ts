import { it, beforeAll } from 'vitest';

// a little trick to restore normal console.log to see genuine chronological order
// https://github.com/vitest-dev/vitest/issues/1405#issuecomment-1858696036
// beforeAll(async () => {
//   const { Console } = await import("node:console");
//   globalThis.console = new Console(process.stdout, process.stderr);
// });

it.concurrent('1st', ({ expect }) => {
  expect("hi1").toMatchInlineSnapshot(`"hi1"`);
});

it.concurrent('2nd', ({ expect }) => {
  expect("hi2").toMatchInlineSnapshot(`"hi2"`);
});

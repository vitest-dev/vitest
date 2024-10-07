import { test } from 'vitest';

test('repro', async () => {
  console.log(1);
  await new Promise((r) => setTimeout(r, 10));
  console.error(2);
  await new Promise((r) => setTimeout(r, 10));
  console.log(3);
});

import { test } from 'vitest';

test('fast', async () => {
  await sleep(10)
});

test('slow', async () => {
  await sleep(200)
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

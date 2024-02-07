import { test } from 'vitest';

test('fast', () => {
});

test('slow', async () => {
  await sleep(300)
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

import { expect, test } from 'vitest';
import { sumInBackground } from '../src/worker-wrapper';

test('run a Worker', async () => {
  const result = await sumInBackground(15, 7);

  expect(result).toBe(22);
});

import { test } from 'vitest';

test('throws', () => {
  const error = new Error('error with properties')
  Object.assign(error, {
    code: 404,
    status: 'not found',
  })
  throw error
});


import { test } from 'vitest';

process.on('unhandledRejection', () => {
  // ignore errors
})

test('throws unhandled but not reported', () => {
  new Promise((resolve, reject) => {
    reject('promise error');
  });
})

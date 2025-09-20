import { describe, test } from 'vitest';

test('a single test', () => {
  // ...
})

test('repeated test', { repeats: 2 }, () => {
  // ...
})

test('retried test', { retry: 2 }, ({ task }) => {
  if (task.result?.retryCount !== 2) {
    throw new Error('failed test')
  }
})

test('repeated retried tests', { repeats: 2, retry: 2 }, ({ task }) => {
  if (task.result?.retryCount !== 2) {
    throw new Error('failed test')
  }
})

describe('nested suite', () => {
  test('suite test', () => {
    // ...
  })

  test.skip('skipped test', () => {
    // ...
  })
})

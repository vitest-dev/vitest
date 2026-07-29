import { test } from 'vitest';

test('fail', () => {
  throw new Error('fail')
})

test('retried fail', { retry: 2 }, () => {
  throw new Error('fail')
})

test('repeated fail', { repeats: 2 }, () => {
  throw new Error('fail')
})

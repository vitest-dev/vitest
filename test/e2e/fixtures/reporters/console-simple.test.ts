import { describe, expect, test } from 'vitest'

test('test', () => {
  console.log('__test_stdout__')
  console.error('__test_stderr__')
  expect(0).toBe(0)
})

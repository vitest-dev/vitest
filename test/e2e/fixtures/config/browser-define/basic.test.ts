import { test, expect } from 'vitest'

test('passes', () => {
  expect(process.env.TEST_PROCESS_ENV).toBe('PROCESS_OK')
  expect(import.meta.env.TEST_META_ENV).toBe('META_OK')
})

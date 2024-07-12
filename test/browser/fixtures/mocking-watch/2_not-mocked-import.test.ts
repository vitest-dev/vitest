import { lib } from '@vitest/cjs-lib/lib'
import { test, expect } from 'vitest'

test('not mocked', () => {
  expect(lib()).toBe('original')
})

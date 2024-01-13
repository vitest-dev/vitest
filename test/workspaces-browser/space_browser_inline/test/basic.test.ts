import { expect, test } from 'vitest'

// @ts-expect-error test vite resolve.alias
import testAlias from 'test-alias-from'

test('window is defined', () => {
  expect(typeof window).toBe('object')
})

test('alias from workspace inline config', () => {
  expect(testAlias).toBe('hello')
})

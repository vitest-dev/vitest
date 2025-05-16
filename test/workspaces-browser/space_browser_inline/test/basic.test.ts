// @ts-expect-error alias
import testAliasVite from 'test-alias-from-vite'

// @ts-expect-error alias
import testAliasVitest from 'test-alias-from-vitest'

import { expect, test } from 'vitest'

test('window is defined', () => {
  expect(typeof window).toBe('object')
})

test('alias from workspace inline config', () => {
  expect(testAliasVite).toBe('hello')
  expect(testAliasVitest).toBe('hello')
})

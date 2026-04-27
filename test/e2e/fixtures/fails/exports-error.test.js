import { test, vi } from 'vitest'

test('__vite_ssr_import__ is removed in error', () => {
  // vi is not a function
  vi()
})

import { describe, expect, test } from 'vitest'
import { removeQuery } from 'vitest/src/runtime/moduleRunner/utils.ts'

describe('moduleRunner utils - removeQuery', () => {
  test('removes the first query parameter and correctly transforms the subsequent parameter prefix', () => {
    const url = 'file.js?_vitest_original&v=12345'
    expect(removeQuery(url, '_vitest_original')).toBe('file.js?v=12345')
  })

  test('removes a unique query parameter cleanly', () => {
    const url = 'file.js?_vitest_original'
    expect(removeQuery(url, '_vitest_original')).toBe('file.js')
  })

  test('removes a non-first query parameter while leaving the first intact', () => {
    const url = 'file.js?v=12345&_vitest_original'
    expect(removeQuery(url, '_vitest_original')).toBe('file.js?v=12345')
  })
})

import { describe, expect, test } from 'vitest'
import { rootLevel } from '../src/root-level'
import { nestedLevel } from '../src/nested/nested-level'

describe('coverage include/exclude patterns', () => {
  test('includes files from top-level', () => {
    expect(rootLevel(5)).toBe(6)
  })

  test('includes files from nested directories', () => {
    expect(nestedLevel(5)).toBe(10)
  })
})

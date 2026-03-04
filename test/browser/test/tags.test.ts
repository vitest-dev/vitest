/**
 * @module-tag browser
 */

import { describe, test } from 'vitest'

describe('suite 1', () => {
  test('test 1', { tags: ['test'] }, () => {})

  describe('suite 2', { tags: ['e2e'] }, () => {
    test('test 2', () => {})
  })
})

import { describe, test } from 'vitest'

describe('suite 1', { tags: ['suite', 'alone'] }, () => {
  test('test 1', () => {})
  test('test 2', { tags: ['test'] }, () => {})

  describe('suite 2', { tags: ['suite_2', 'suite'] }, () => {
    test('test 3', () => {})
    test('test 4', { tags: ['test_2'] }, () => {})
  })
})

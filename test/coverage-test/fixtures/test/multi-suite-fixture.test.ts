import { describe, expect, test } from "vitest"
import MultiSuite from '../src/multi-suite'

describe('Multiple test suites', () => {
  describe('suite for func1', () => {
    test('func1', () => {
      const data = ['a', 'b']
      const val = MultiSuite.func1(data)
      expect(val).toEqual(data)
    })
  })

  describe('suite for func2', () => {
    test('func2', () => {
      const data = ['c', 'd']
      const val = MultiSuite.func2(data)
      expect(val).toEqual(data)
    })
  })
})

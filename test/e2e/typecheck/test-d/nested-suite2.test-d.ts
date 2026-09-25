import { describe, test } from 'vitest'

describe('suite-A', () => {
  describe('suite-B', () => {
    test('case-X', () => {
    })

    describe('suite-C', () => {
      test('case-Y', () => {
      })
    })
  })

  describe('suite-D', () => {
    test('case-Z', () => {
    })
  })
})

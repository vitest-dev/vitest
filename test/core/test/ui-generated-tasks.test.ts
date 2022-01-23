import { describe, expect, it } from 'vitest'

describe('Test UI root describe', () => {
  for (let index_d = 1; index_d <= 50; index_d++) {
    describe(`Test UI nested describe ${index_d}`, () => {
      for (let index_i = 1; index_i <= 20; index_i++) {
        it(`Test UI it ${index_d}-${index_i}`, () => {
          expect(true).toBe(true)
        })
      }
    })
  }
})

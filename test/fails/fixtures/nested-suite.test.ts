import { describe, it, expect } from 'vitest'

describe('a', () => {
  describe('b', () => {
    describe('c', () => {
      describe('d', () => {
        describe('e', () => {
          it('very deep', () => {
            expect(true).toBe(false)
          })
        })
      })
    })
  })
})

import { describe, expect, it } from 'vitest'

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

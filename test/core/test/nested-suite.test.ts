import { describe, it, expect } from 'vitest'

let visited = false

it('visited before', () => {
  expect(visited).toBe(false)
})

describe('a', () => {
  describe('b', () => {
    describe('c', () => {
      describe('d', () => {
        describe('e', () => {
          it('very deep', () => {
            expect(true).toBe(true)
            visited = true
            expect('hi').toMatchSnapshot('msg')
          })
        })
      })
    })
  })
})

it('visited', () => {
  expect(visited).toBe(true)
})

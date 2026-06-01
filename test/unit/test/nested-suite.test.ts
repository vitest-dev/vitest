import { describe, expect, it } from 'vitest'

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

it('suite inside test should throw', () => {
  expect(() => {
    describe('inside test', () => {})
  }).toThrowErrorMatchingInlineSnapshot(`[Error: Calling the suite function inside test function is not allowed. It can be only called at the top level or inside another suite function.]`)
})

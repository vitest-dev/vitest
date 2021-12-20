import { beforeAll, beforeEach, expect, it, suite } from 'vitest'

let count = 0

beforeAll(() => {
  count = 0
})

beforeEach(() => {
  count += 1
})

it('one', () => {
  expect(count).toBe(1)
})

suite('level1', () => {
  it('two', () => {
    expect(count).toBe(2)
  })

  it('three', () => {
    expect(count).toBe(3)
  })

  suite('level 2', () => {
    beforeEach(() => {
      count += 1
    })

    it('five', () => {
      expect(count).toBe(5)
    })

    suite('level 3', () => {
      it('seven', () => {
        expect(count).toBe(7)
      })
    })
  })

  suite('level 2 with nested beforeAll', () => {
    beforeAll(() => {
      count = 0
    })

    it('one', () => {
      expect(count).toBe(1)
    })
  })

  it('two', () => {
    expect(count).toBe(2)
  })
})

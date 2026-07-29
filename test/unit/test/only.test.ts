import { describe, expect, it } from 'vitest'

const run = [false, false, false, false]

it.only('visited before', () => {
  expect(run.some(Boolean)).toBe(false)
})

describe('a0', () => {
  it.only('0', () => {
    run[0] = true
  })
  it('s0', () => {
    expect(true).toBe(false)
  })
})

describe('a1', () => {
  describe('b1', () => {
    describe('c1', () => {
      it.only('1', () => {
        run[1] = true
      })
    })
    it('s1', () => {
      expect(true).toBe(false)
    })
  })
})

describe.only('a2', () => {
  it('2', () => {
    run[2] = true
  })
})

it('s2', () => {
  expect(true).toBe(false)
})

describe.only('a3', () => {
  describe('b3', () => {
    it('3', () => {
      run[3] = true
    })
  })
  it.skip('s3', () => {
    expect(true).toBe(false)
  })
})

describe('a4', () => {
  describe.only('b4', () => {
    it('4', () => {
      run[4] = true
    })
  })
  describe('sb4', () => {
    it('s4', () => {
      expect(true).toBe(false)
    })
  })
})

it.only('visited', () => {
  expect(run.every(Boolean)).toBe(true)
})

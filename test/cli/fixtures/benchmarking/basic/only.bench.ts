import { bench, describe, expect, assert } from 'vitest'

const run = [false, false, false, false, false]

describe('a0', () => {
  bench.only('0', () => {
    run[0] = true
  }, { iterations: 1, time: 0 })
  bench('s0', () => {
    expect(true).toBe(false)
  })
})

describe('a1', () => {
  describe('b1', () => {
    describe('c1', () => {
      bench.only('1', () => {
        run[1] = true
      }, { iterations: 1, time: 0 })
    })
    bench('s1', () => {
      expect(true).toBe(false)
    })
  })
})

describe.only('a2', () => {
  bench('2', () => {
    run[2] = true
  }, { iterations: 1, time: 0 })
})

bench('s2', () => {
  expect(true).toBe(false)
})

describe.only('a3', () => {
  describe('b3', () => {
    bench('3', () => {
      run[3] = true
    }, { iterations: 1, time: 0 })
  })
  bench.skip('s3', () => {
    expect(true).toBe(false)
  })
})

describe('a4', () => {
  describe.only('b4', () => {
    bench('4', () => {
      run[4] = true
    }, { iterations: 1, time: 0 })
  })
  describe('sb4', () => {
    bench('s4', () => {
      expect(true).toBe(false)
    })
  })
})

bench.only(
  'visited',
  () => {
    assert.deepEqual(run, [true, true, true, true, true])
  },
  { iterations: 1, time: 0 },
)

bench.only(
  'visited2',
  () => {
    assert.deepEqual(run, [true, true, true, true, true])
  },
  { iterations: 1, time: 0 },
)

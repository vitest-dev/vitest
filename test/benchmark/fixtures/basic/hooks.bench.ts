import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  bench,
  describe,
  expect,
} from 'vitest'

describe('hooks', () => {
  let cleanUpCount = 0
  describe('run', () => {
    beforeAll(() => {
      cleanUpCount += 10
    })
    beforeEach(() => {
      cleanUpCount += 1
    })
    afterEach(() => {
      cleanUpCount -= 1
    })
    afterAll(() => {
      cleanUpCount -= 10
    })

    bench('one', () => {
      expect(cleanUpCount).toBe(11)
    })
    bench('two', () => {
      expect(cleanUpCount).toBe(11)
    })
  })
  bench('end', () => {
    expect(cleanUpCount).toBe(0)
  })
})

describe('hooks-cleanup', () => {
  let cleanUpCount = 0
  beforeAll(() => {
    cleanUpCount += 10
    return () => {
      cleanUpCount -= 10
    }
  })
  beforeEach(() => {
    cleanUpCount += 1
    return () => {
      cleanUpCount -= 1
    }
  })

  bench('one', () => {
    expect(cleanUpCount).toBe(11)
  })
  bench('two', () => {
    expect(cleanUpCount).toBe(11)
  })
})

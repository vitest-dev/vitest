import { afterAll, afterEach, assert, beforeAll, beforeEach, describe, it } from 'vitest'

describe('before and after hooks', () => {
  let eachState = 'start'
  let eachCount = 0
  let allState = 'start'
  let allCount = 0

  beforeAll(() => {
    allState = 'running'
  })
  afterAll(() => {
    allState = 'done'
    allCount++
  })

  beforeEach(() => {
    eachState = 'running'
  })
  afterEach(() => {
    eachState = 'done'
    eachCount++
  })

  // Hooks accepting a timeout
  beforeAll(async() => { }, 1000)
  afterAll(async() => { }, 1000)
  beforeEach(async() => { }, 1000)
  afterEach(async() => { }, 1000)

  beforeAll(async() => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve()
      }, 100)
    })
  }, 200)

  it('beforeEach works', () => {
    assert.equal(eachState, 'running')
  })

  // It should work if tests are run in serial, skip for now
  it.skip('afterEach called', () => {
    assert.equal(eachState, 'running')
    assert.equal(eachCount, 1)
  })

  it('beforeAll works', () => {
    assert.equal(allState, 'running')
  })

  it('afterAll not called', () => {
    assert.equal(allState, 'running')
    assert.equal(allCount, 0)
  })
})

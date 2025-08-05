import {describe, test, expect, afterAll, beforeAll, beforeEach, afterEach} from 'vitest'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
declare const __CONCURRENCY_LIMIT__: number

describe(`Verifying hooks and tests in describe.concurrent respect the limit of ${__CONCURRENCY_LIMIT__}`, () => {
  let running = 0
  let maxObserved = 0

  async function track() {
    running++
    maxObserved = Math.max(maxObserved, running)
    expect(running).toBeLessThanOrEqual(__CONCURRENCY_LIMIT__)
    await delay(30)
    running--
  }

  describe.concurrent('inner concurrent suite', () => {
    beforeAll(() => track())
    for (let i = 1; i <= __CONCURRENCY_LIMIT__ + 10; i++){
      describe.concurrent(`inner suite #${i}`, () => {
        beforeEach(() => track())
        test(`test #${i}`, () => track())
        afterEach(() => track())
      })
    }
    afterAll(() => track())
  })

  afterAll(() => {
    const expectedMax = Math.min(__CONCURRENCY_LIMIT__, maxObserved)
    expect(maxObserved).toBe(expectedMax)
  })
})


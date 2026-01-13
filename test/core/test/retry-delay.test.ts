import { describe, expect, it } from 'vitest'

let delayCount = 0
let delayStart = 0

it('retry with delay', {
  retry: {
    count: 2,
    delay: 100,
  },
}, () => {
  if (delayCount === 0) {
    delayStart = Date.now()
  }
  delayCount += 1
  expect(delayCount).toBe(3)
})

it('verify delay was applied', () => {
  const duration = Date.now() - delayStart
  expect(delayCount).toBe(3)
  // With 2 retries and 100ms delay each, should take at least 200ms
  expect(duration).toBeGreaterThanOrEqual(200)
})

let zeroDelayCount = 0

it('retry with zero delay', {
  retry: {
    count: 2,
    delay: 0,
  },
}, () => {
  zeroDelayCount += 1
  expect(zeroDelayCount).toBe(3)
})

it('verify zero delay test passed', () => {
  expect(zeroDelayCount).toBe(3)
})

describe('retry delay with describe', {
  retry: {
    count: 2,
    delay: 50,
  },
}, () => {
  let describeCount = 0
  it('test should inherit retryDelay from describe block', () => {
    describeCount += 1
    expect(describeCount).toBe(2)
  })
})

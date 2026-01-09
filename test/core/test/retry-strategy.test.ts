import { describe, expect, it } from 'vitest'

// Test with immediate strategy (default)
let immediateCount = 0
it('retry with immediate strategy', { retry: 2 }, () => {
  immediateCount += 1
  expect(immediateCount).toBe(3)
})

it('verify immediate strategy retried', () => {
  expect(immediateCount).toBe(3)
})

// Test with test-file strategy
// Note: With test-file strategy, the test retries after all tests in the file complete.
// The test itself validates that it ran 3 times (1 initial + 2 retries) by eventually passing.
let testFileCount = 0
it('retry with test-file strategy', {
  retry: {
    count: 2,
    strategy: 'test-file',
  },
}, () => {
  testFileCount += 1
  // This will fail on attempts 1 and 2, pass on attempt 3
  expect(testFileCount).toBe(3)
})

// Test with deferred strategy
// Note: With deferred strategy, the test retries after all test files complete.
// The test itself validates that it ran 3 times (1 initial + 2 retries) by eventually passing.
let deferredCount = 0
it('retry with deferred strategy', {
  retry: {
    count: 2,
    strategy: 'deferred',
  },
}, () => {
  deferredCount += 1
  // This will fail on attempts 1 and 2, pass on attempt 3
  expect(deferredCount).toBe(3)
})

describe('retry strategy with describe', {
  retry: {
    count: 2,
    strategy: 'immediate',
  },
}, () => {
  let describeCount = 0
  it('test should inherit retryStrategy from describe block', () => {
    describeCount += 1
    expect(describeCount).toBe(2)
  })
})

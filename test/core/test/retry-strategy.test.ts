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
let testFileCount = 0
it('retry with test-file strategy', { retry: 2, retryStrategy: 'test-file' }, () => {
  testFileCount += 1
  expect(testFileCount).toBe(3)
})

it('verify test-file strategy retried', () => {
  expect(testFileCount).toBe(3)
})

// Test with deferred strategy
let deferredCount = 0
it('retry with deferred strategy', { retry: 2, retryStrategy: 'deferred' }, () => {
  deferredCount += 1
  expect(deferredCount).toBe(3)
})

it('verify deferred strategy retried', () => {
  expect(deferredCount).toBe(3)
})

describe('retry strategy with describe', { retry: 2, retryStrategy: 'immediate' }, () => {
  let describeCount = 0
  it('test should inherit retryStrategy from describe block', () => {
    describeCount += 1
    expect(describeCount).toBe(2)
  })
})

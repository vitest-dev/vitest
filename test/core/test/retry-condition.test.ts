import type { TestError } from 'vitest'
import { describe, expect, it } from 'vitest'

// Test with RegExp condition that eventually passes
let matchingCount = 0
it('retry with matching condition', {
  retry: {
    count: 5,
    condition: /retry/i,
  },
}, () => {
  matchingCount += 1
  if (matchingCount < 3) {
    throw new Error('Please retry this test')
  }
  // Third attempt succeeds
})

it('verify matching condition retried', () => {
  expect(matchingCount).toBe(3)
})

// Test with no condition (should retry all errors)
let noConditionCount = 0
it('retry without condition', { retry: 2 }, () => {
  noConditionCount += 1
  expect(noConditionCount).toBe(3)
})

it('verify no condition retried all attempts', () => {
  expect(noConditionCount).toBe(3)
})

// Test with function condition
let functionCount = 0
const condition = (error: TestError) => error.name === 'TimeoutError'

it('retry with function condition', {
  retry: {
    count: 5,
    condition,
  },
}, () => {
  functionCount += 1
  const err: any = new Error('Test failed')
  err.name = 'TimeoutError'
  if (functionCount < 3) {
    throw err
  }
  // Third attempt succeeds
})

it('verify function condition worked', () => {
  expect(functionCount).toBe(3)
})

describe('retry condition with describe', {
  retry: {
    count: 2,
    condition: /flaky/i,
  },
}, () => {
  let describeCount = 0
  it('test should inherit retryCondition from describe block', () => {
    describeCount += 1
    if (describeCount === 1) {
      throw new Error('Flaky test error')
    }
    // Second attempt succeeds
  })
})

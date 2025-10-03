import type { SerializedConfig } from '../runtime/config'

export function normalizeRetryConfig(
  retry: SerializedConfig['retry']
): {
  count: number
  strategy: 'immediate' | 'test-file' | 'deferred'
  delay: number
  condition?: string | RegExp | ((error: Error) => boolean)
} {
  if (typeof retry === 'number') {
    return {
      count: retry,
      strategy: 'immediate',
      delay: 0,
    }
  }

  return {
    count: retry.count ?? 0,
    strategy: retry.strategy ?? 'immediate',
    delay: retry.delay ?? 0,
    condition: retry.condition,
  }
}

export function shouldRetryOnError(
  error: Error,
  condition?: string | RegExp | ((error: Error) => boolean)
): boolean {
  if (!condition) {
    return true
  }

  if (typeof condition === 'string') {
    return error.message.includes(condition)
  }

  if (condition instanceof RegExp) {
    return condition.test(error.message)
  }

  if (typeof condition === 'function') {
    try {
      return condition(error)
    } catch {
      return false
    }
  }

  return true
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function calculateBackoffDelay(
  baseDelay: number,
  retryCount: number,
  algorithm: 'linear' | 'exponential' = 'linear'
): number {
  switch (algorithm) {
    case 'exponential':
      return baseDelay * Math.pow(2, retryCount)
    case 'linear':
    default:
      return baseDelay
  }
}

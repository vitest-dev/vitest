import type { MatchersObject } from '@vitest/expect'
import type { BenchResult } from '@vitest/runner'

function isBenchResult(value: unknown): value is BenchResult {
  return (
    typeof value === 'object'
    && value !== null
    && 'latency' in value
    && typeof (value as any).latency?.mean === 'number'
  )
}

function formatOps(ops: number): string {
  return ops.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const benchMatchers: MatchersObject = {
  toBeFasterThan(actual: unknown, expected: unknown, options?: { delta?: number }) {
    const { matcherHint, RECEIVED_COLOR, EXPECTED_COLOR } = this.utils
    const delta = options?.delta ?? 0

    if (!isBenchResult(actual)) {
      throw new TypeError(
        `${matcherHint('.toBeFasterThan')} expects the actual value to be a benchmark result.`,
      )
    }
    if (!isBenchResult(expected)) {
      throw new TypeError(
        `${matcherHint('.toBeFasterThan')} expects the expected value to be a benchmark result.`,
      )
    }

    const threshold = expected.latency.mean * (1 - delta)
    const pass = actual.latency.mean < threshold

    return {
      pass,
      message: () => {
        const relation = ((actual.latency.mean - expected.latency.mean) / expected.latency.mean * 100).toFixed(2)
        return pass
          ? `${matcherHint('.not.toBeFasterThan')}\n\nExpected to not be faster, but was ${Math.abs(Number(relation))}% faster.\n\n`
          + `Received: ${RECEIVED_COLOR(formatOps(actual.throughput.mean))} ops/sec\n`
          + `Expected: ${EXPECTED_COLOR(formatOps(expected.throughput.mean))} ops/sec\n`
          : `${matcherHint('.toBeFasterThan')}\n\nExpected to be faster${delta > 0 ? ` by at least ${(delta * 100).toFixed(0)}%` : ''}, but was ${Number(relation) > 0 ? `${relation}% slower` : `only ${Math.abs(Number(relation))}% faster`}.\n\n`
            + `Received: ${RECEIVED_COLOR(formatOps(actual.throughput.mean))} ops/sec\n`
            + `Expected: ${EXPECTED_COLOR(formatOps(expected.throughput.mean))} ops/sec\n`
      },
    }
  },

  toBeSlowerThan(actual: unknown, expected: unknown, options?: { delta?: number }) {
    const { matcherHint, RECEIVED_COLOR, EXPECTED_COLOR } = this.utils
    const delta = options?.delta ?? 0

    if (!isBenchResult(actual)) {
      throw new TypeError(
        `${matcherHint('.toBeSlowerThan')} expects the actual value to be a benchmark result.`,
      )
    }
    if (!isBenchResult(expected)) {
      throw new TypeError(
        `${matcherHint('.toBeSlowerThan')} expects the expected value to be a benchmark result.`,
      )
    }

    const threshold = expected.latency.mean * (1 + delta)
    const pass = actual.latency.mean > threshold

    return {
      pass,
      message: () => {
        const relation = ((actual.latency.mean - expected.latency.mean) / expected.latency.mean * 100).toFixed(2)
        return pass
          ? `${matcherHint('.not.toBeSlowerThan')}\n\nExpected to not be slower, but was ${relation}% slower.\n\n`
          + `Received: ${RECEIVED_COLOR(formatOps(actual.throughput.mean))} ops/sec\n`
          + `Expected: ${EXPECTED_COLOR(formatOps(expected.throughput.mean))} ops/sec\n`
          : `${matcherHint('.toBeSlowerThan')}\n\nExpected to be slower${delta > 0 ? ` by at least ${(delta * 100).toFixed(0)}%` : ''}, but was ${Number(relation) < 0 ? `${Math.abs(Number(relation))}% faster` : `only ${relation}% slower`}.\n\n`
            + `Received: ${RECEIVED_COLOR(formatOps(actual.throughput.mean))} ops/sec\n`
            + `Expected: ${EXPECTED_COLOR(formatOps(expected.throughput.mean))} ops/sec\n`
      },
    }
  },
}

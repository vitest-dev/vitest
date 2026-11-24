import type { BrowserTraceData, BrowserTraceEntry } from '@vitest/utils/trace'
import type { Test } from './runner/types'
import { recordArtifact } from './runner/artifact'
import { getCurrentTest, getRunningTests } from './runner/test-state'

export interface TraceAttempt {
  retry: number
  repeats: number
  startTime: number
  // `.stack` is formatted on first access, so passing attempts never pay for it
  entries: { entry: BrowserTraceEntry; source: Error }[]
}

const attempts = new WeakMap<Test, TraceAttempt>()
// `vi.useFakeRandom()` replaces `Math.random`
const random = Math.random

export function startTraceAttempt(test: Test, options: { retry: number; repeats: number }): void {
  attempts.set(test, { ...options, startTime: performance.now(), entries: [] })
}

export function getTraceAttempt(test: Test): TraceAttempt | undefined {
  return attempts.get(test)
}

export function createTraceRangeId(): string {
  return random().toString(36).slice(2)
}

export function recordTraceEntry(
  attempt: TraceAttempt,
  entry: Omit<BrowserTraceEntry, 'startTime' | 'stack'>,
  source: Error,
): void {
  attempt.entries.push({
    entry: { ...entry, startTime: performance.now() - attempt.startTime },
    source,
  })
}

export function startPromiseTraceRange(
  name: string,
  source: Error,
): <T>(promise: Promise<T>) => Promise<T> {
  const test = getCurrentTest()
  // the current test is a guess when several tests run concurrently
  const attempt = test && getRunningTests().size === 1 ? attempts.get(test) : undefined
  if (!attempt) {
    return (promise) => promise
  }
  const id = createTraceRangeId()
  recordTraceEntry(attempt, { name, kind: 'expect', range: { id, phase: 'start' } }, source)
  const end = (status: 'pass' | 'fail') =>
    recordTraceEntry(attempt, { name, kind: 'expect', range: { id, phase: 'end' }, status }, source)
  return (promise) => {
    promise.then(
      () => end('pass'),
      () => end('fail'),
    )
    return promise
  }
}

export async function finishTraceAttempt(test: Test): Promise<void> {
  const attempt = attempts.get(test)
  attempts.delete(test)
  // record only failed attempts
  if (!attempt || test.result?.state !== 'fail' || !attempt.entries.length) {
    return
  }
  // locations are resolved in the main process, like error stacks
  const entries = attempt.entries.map(({ entry, source }) => ({
    ...entry,
    stack: source.stack,
  }))
  const data: BrowserTraceData = { retry: attempt.retry, repeats: attempt.repeats, entries }
  await recordArtifact(test, { type: 'internal:browserTrace', data })
}

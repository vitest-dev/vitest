import type { Test } from './runner/types'
import { recordArtifact } from './runner/artifact'
import { getCurrentTest, getRunningTests } from './runner/test-state'

// TODO: share the trace data types with browser mode (https://github.com/vitest-dev/vitest/pull/11604)
interface TraceEntry {
  name: string
  kind: 'expect' | 'lifecycle'
  range?: { id: string; phase: 'start' | 'end' }
  status?: 'pass' | 'fail'
  startTime: number
  stack?: string
}

export interface TraceAttempt {
  retry: number
  repeats: number
  startTime: number
  // `.stack` is formatted on first access, so passing attempts never pay for it
  entries: { entry: TraceEntry; source?: Error }[]
}

const attempts = new WeakMap<Test, TraceAttempt>()

export function startTraceAttempt(test: Test, options: { retry: number; repeats: number }): void {
  attempts.set(test, { ...options, startTime: performance.now(), entries: [] })
}

export function getTraceAttempt(test: Test): TraceAttempt | undefined {
  return attempts.get(test)
}

export function createTraceRangeId(): string {
  return Math.random().toString(36).slice(2)
}

export function recordTraceEntry(
  attempt: TraceAttempt,
  entry: Omit<TraceEntry, 'startTime' | 'stack'>,
  source?: Error,
): void {
  attempt.entries.push({
    entry: { ...entry, startTime: performance.now() - attempt.startTime },
    source,
  })
}

export function startTraceRange(
  name: string,
  source: Error,
): <T>(promise: Promise<T>) => Promise<T> {
  const test = getCurrentTest()
  // the current test is a guess when several tests run concurrently
  const end =
    test && getRunningTests().size === 1 ? startRange(test, name, 'expect', source) : undefined
  if (!end) {
    return (promise) => promise
  }
  return (promise) => {
    promise.then(
      () => end('pass'),
      () => end('fail'),
    )
    return promise
  }
}

export function recordLifecycleMark(test: Test, name: string): void {
  const attempt = attempts.get(test)
  if (attempt) {
    recordTraceEntry(attempt, { name, kind: 'lifecycle' })
  }
}

export function startLifecycleRange(
  test: Test | undefined,
  name: string,
  source: Error | undefined,
): ((status: 'pass' | 'fail') => void) | undefined {
  return test && source && startRange(test, name, 'lifecycle', source)
}

export function traceLifecycle<T>(
  test: Test | undefined,
  name: string,
  source: Error | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const end = startLifecycleRange(test, name, source)
  if (!end) {
    return fn()
  }
  return fn().then(
    (value) => {
      end('pass')
      return value
    },
    (error) => {
      end('fail')
      throw error
    },
  )
}

function startRange(
  test: Test,
  name: string,
  kind: TraceEntry['kind'],
  source: Error,
): ((status: 'pass' | 'fail') => void) | undefined {
  const attempt = attempts.get(test)
  if (!attempt) {
    return
  }
  const id = createTraceRangeId()
  recordTraceEntry(attempt, { name, kind, range: { id, phase: 'start' } }, source)
  return (status) =>
    recordTraceEntry(attempt, { name, kind, range: { id, phase: 'end' }, status }, source)
}

export async function finishTraceAttempt(test: Test): Promise<void> {
  const attempt = attempts.get(test)
  attempts.delete(test)
  // record only failed attempts
  if (
    !attempt ||
    test.result?.state !== 'fail' ||
    !attempt.entries.some(({ entry }) => entry.range)
  ) {
    return
  }
  // locations are resolved in the main process, like error stacks
  const entries = attempt.entries.map(({ entry, source }) => ({
    ...entry,
    stack: source?.stack,
  }))
  await recordArtifact(test, {
    type: 'internal:browserTrace',
    data: { retry: attempt.retry, repeats: attempt.repeats, entries },
  })
}

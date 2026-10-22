import type { Test } from './runner/types'
import { recordArtifact } from './runner/artifact'

// TODO: share the trace data types with browser mode (https://github.com/vitest-dev/vitest/pull/11604)
interface TraceEntry {
  name: string
  kind: 'expect'
  range: { id: string; phase: 'start' | 'end' }
  status?: 'pass' | 'fail'
  startTime: number
  stack?: string
}

export interface TraceAttempt {
  retry: number
  repeats: number
  startTime: number
  entries: { entry: TraceEntry; source: Error }[]
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
  source: Error,
): void {
  attempt.entries.push({
    entry: { ...entry, startTime: performance.now() - attempt.startTime },
    source,
  })
}

export async function finishTraceAttempt(test: Test): Promise<void> {
  const attempt = attempts.get(test)
  attempts.delete(test)
  // `test.fails` flips the result after the attempt
  const failed = (test.result?.state === 'fail') !== !!test.fails
  if (!attempt || !failed || !attempt.entries.length) {
    return
  }
  // locations are resolved in the main process, like error stacks
  const entries = attempt.entries.map(({ entry, source }) => ({
    ...entry,
    stack: getStack(source),
  }))
  await recordArtifact(test, {
    type: 'internal:browserTrace',
    data: { retry: attempt.retry, repeats: attempt.repeats, entries },
  })
}

function getStack(error: Error) {
  try {
    return error.stack
  } catch {
    // accessing `.stack` can throw if the test froze `Object.prototype`
    return undefined
  }
}

import type { Test } from './runner/types'
import { recordArtifact } from './runner/artifact'
import { findTestFileStackTrace } from './runner/utils/collect'

// TODO: share the trace data types with browser mode (https://github.com/vitest-dev/vitest/pull/11604)
interface TraceEntry {
  name: string
  kind: 'expect'
  range: { id: string; phase: 'start' | 'end' }
  status?: 'pass' | 'fail'
  startTime: number
  location?: { file: string; line: number; column: number }
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
  entry: Omit<TraceEntry, 'startTime' | 'location'>,
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
  const entries = attempt.entries.map(({ entry, source }) => {
    const stack = findTestFileStackTrace(test.file.filepath, source)
    return {
      ...entry,
      location: stack && { file: stack.file, line: stack.line, column: stack.column },
    }
  })
  await recordArtifact(test, {
    type: 'internal:browserTrace',
    data: { retry: attempt.retry, repeats: attempt.repeats, entries },
  })
}

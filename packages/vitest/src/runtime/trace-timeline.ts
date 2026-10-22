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

interface TraceAttempt {
  retry: number
  repeats: number
  startTime: number
}

const attempts = new WeakMap<Test, TraceAttempt>()

export function startTraceAttempt(test: Test, options: { retry: number; repeats: number }): void {
  attempts.set(test, { ...options, startTime: performance.now() })
}

export function createTraceRangeId(): string {
  return Math.random().toString(36).slice(2)
}

export async function recordTraceEntry(
  test: Test,
  entry: Omit<TraceEntry, 'startTime' | 'location'>,
  source: Error,
): Promise<void> {
  const attempt = attempts.get(test)
  if (!attempt) {
    return
  }
  const stack = findTestFileStackTrace(test.file.filepath, source)
  const { retry, repeats, startTime } = attempt
  await recordArtifact(test, {
    type: 'internal:browserTrace',
    data: {
      retry,
      repeats,
      entries: [
        {
          ...entry,
          startTime: performance.now() - startTime,
          location: stack && { file: stack.file, line: stack.line, column: stack.column },
        },
      ],
    },
  })
}

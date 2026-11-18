import type { RandomTape, RandomTapeOptions } from '@vitest/utils/random-tape'
import type {
  TaskDivergentCall,
  TaskResultAttempt,
  TaskResultDivergence,
  Test,
  VitestRunner,
} from './types'
import { formatRandomCall, getHiddenRunTimeout, runHiddenAttempt } from './shrink-attempt'
import { setShrinkSearchRun } from './test-state'

// the stack of each call costs about 1.5 KB and 4 µs
const MAX_COMPARED_CALLS = 10_000
// the calls of fake timers have about 10 frames of Vitest and sinon above the code of the test
const STACK_TRACE_LIMIT = 20

interface LoggedCall {
  text: string
  reads: number
  // `.stack` is formatted only for the first call that is different
  source: Error
}

export interface RandomCallLog {
  readonly calls: LoggedCall[]
  readonly tapeOptions: RandomTapeOptions
}

export function createRandomCallLog(): RandomCallLog {
  const calls: LoggedCall[] = []
  return {
    calls,
    tapeOptions: {
      onCall: (call) => {
        calls.push({ text: formatRandomCall(call, true), reads: call.reads, source: capture() })
      },
      maxReportedCalls: MAX_COMPARED_CALLS,
    },
  }
}

// Runs the seed 1 more time, and compares its random calls with the calls of the replay, which
// did not fail again in the same way.
export async function findDivergence(
  test: Test,
  runner: VitestRunner,
  replay: TaskResultAttempt,
  replayTape: RandomTape,
  log: RandomCallLog,
  createTape: (options: RandomTapeOptions) => RandomTape,
): Promise<TaskResultDivergence> {
  let index = 0
  let same: number | undefined
  let calls: TaskResultDivergence['calls']
  const tape = createTape({
    // 1 call after the end of the log shows that this run made more calls
    maxReportedCalls: log.calls.length + 1,
    onCall: (call) => {
      const i = index++
      if (same !== undefined) {
        return
      }
      const logged = log.calls[i]
      if (!logged) {
        same = i
        return
      }
      const text = formatRandomCall(call, true)
      if (text !== logged.text || call.reads !== logged.reads) {
        same = i
        calls = [toDivergentCall(logged), toDivergentCall({ text, source: capture() })]
      }
    },
  })
  setShrinkSearchRun(test, true)
  try {
    await runHiddenAttempt(test, runner, replay, tape, getHiddenRunTimeout(replay))
  } finally {
    setShrinkSearchRun(test, false)
  }
  return {
    counts: [replayTape.callCount, tape.callCount],
    same: same ?? Math.min(log.calls.length, tape.callCount),
    calls,
  }
}

function capture(): Error {
  const limit = Error.stackTraceLimit
  Error.stackTraceLimit = Math.max(limit, STACK_TRACE_LIMIT)
  const error = new Error('STACK_TRACE')
  Error.stackTraceLimit = limit
  return error
}

function toDivergentCall({ text, source }: Pick<LoggedCall, 'text' | 'source'>): TaskDivergentCall {
  let stack: string | undefined
  try {
    stack = source.stack
  } catch {
    // accessing `.stack` runs `Error.prepareStackTrace`, which can throw
  }
  return stack ? { text, stack } : { text }
}

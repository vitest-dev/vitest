import type { TestError } from '@vitest/utils'
import type { RandomCall, RandomTapeOptions, RandomTapeStream } from '@vitest/utils/random-tape'
import type {
  TaskResultAttempt,
  TaskResultShrink,
  TaskShrinkCall,
  TaskShrinkProgress,
  TaskState,
  Test,
  VitestRunner,
} from './types'
import { inspect } from '@vitest/utils/display'
import { decodeRandomTape, encodeRandomTape, RandomTape } from '@vitest/utils/random-tape'
import { parseStacktrace } from '@vitest/utils/source-map'
import { getSafeTimers } from '@vitest/utils/timers'
import { DEFAULT_SHRINK_TIME, shortenTape } from '../../utils/random'
import { countSameFailures } from '../../utils/tasks'
import { abortContextSignal, resetContextSignal } from './context'
import { TestRunAbortError } from './errors'
import { runTestAttempt, updateTask } from './run'
import { startSeedAttempt } from './seed'
import { countValues, shrinkTape } from './shrink'
import { setShrinkSearchRun } from './test-state'

const now = globalThis.performance
  ? globalThis.performance.now.bind(globalThis.performance)
  : Date.now
const { clearTimeout, setTimeout } = getSafeTimers()

const YIELD_INTERVAL = 100
const MAX_SHOWN_CALLS = 10
// the calls of fake timers have about 10 frames of Vitest and sinon above the code of the test
const STACK_TRACE_LIMIT = 20
const MAX_ERROR_LINE_LENGTH = 200
// a hidden run of the seed can take this many times as long as the attempt
const RUN_TIMEOUT_FACTOR = 10
const MIN_RUN_TIMEOUT = 200

let decodedReplayTape: { text: string; streams: RandomTapeStream[] } | undefined

// with `options` and without `record`, the tape only counts the values and reports the calls
export function createAttemptTape(
  config: VitestRunner['config'],
  record: boolean,
  options?: RandomTapeOptions,
): RandomTape | undefined {
  if (config.replayTape) {
    return createReplayTape(config.replayTape, options)
  }
  return record || options ? new RandomTape({ ...options, record }) : undefined
}

// a test with `shrink: false`, a test that must fail, and a replay of a tape do not search
export function getShrinkTime(test: Test, config: VitestRunner['config']): number | undefined {
  if (test.shrink === false || test.fails || config.replayTape) {
    return undefined
  }
  // the option of a test wins over the config file, but not over `--shrink <time>` or `--no-shrink`
  if (test.shrink == null || config.shrinkFromCli) {
    return config.shrink
  }
  return test.shrink === true ? (config.shrink ?? DEFAULT_SHRINK_TIME) : test.shrink
}

// after the values of the tape, each fork reads the values of its seed, so a test that reads
// more values after a change of the code still runs
export function createReplayTape(text: string, options?: RandomTapeOptions): RandomTape {
  if (decodedReplayTape?.text !== text) {
    // the config and `seeds` check the tape before the run
    const streams = decodeRandomTape(text)
    if (!streams) {
      throw new TypeError(`The random tape ${JSON.stringify(shortenTape(text))} is not valid.`)
    }
    decodedReplayTape = { text, streams }
  }
  return new RandomTape({ ...options, streams: decodedReplayTape.streams, afterEnd: 'seed' })
}

export interface FailedSeed {
  /** the first run of the seed, and its replay or retries */
  runs: TaskResultAttempt[]
  /** the values of the last run; a replay of a tape has none, because it does not search */
  tape: RandomTape | undefined
}

// 1 search for each kind of failure, with the first seed that failed in the same way on each
// run, as the report shows it
export function selectFailedSeed(
  failedSeeds: Map<string, FailedSeed>,
  test: Test,
  repeatIndex: number,
  tape: RandomTape | undefined,
): void {
  const attempts = test.result?.attempts ?? []
  let start = attempts.length
  while (start > 0 && attempts[start - 1].repeatIndex === repeatIndex) {
    start--
  }
  const runs = attempts.slice(start)
  if (!runs[0]?.seed || countSameFailures(runs) < runs.length) {
    return
  }
  const failure = getFailureKey(runs[0].errors?.[0])
  if (failure && !failedSeeds.has(failure)) {
    failedSeeds.set(failure, { runs, tape })
  }
}

export async function shrinkFailedSeeds(
  test: Test,
  runner: VitestRunner,
  failedSeeds: FailedSeed[],
  timeLimit: number,
): Promise<void> {
  // the searches of 1 test share the time limit
  const deadline = now() + timeLimit
  for (const failedSeed of failedSeeds) {
    if (test.context.signal.reason instanceof TestRunAbortError) {
      return
    }
    await shrinkFailedSeed(test, runner, failedSeed, deadline)
  }
}

// Runs the failed seed again with smaller random values until the time limit. The runs of the
// seed get the errors of the smallest input that fails in the same way.
async function shrinkFailedSeed(
  test: Test,
  runner: VitestRunner,
  { runs, tape }: FailedSeed,
  deadline: number,
): Promise<void> {
  const attempt = runs[runs.length - 1]
  const originalError = attempt.errors?.[0]
  const initial = tape?.getRecords() ?? []
  const initialValues = countValues(initial)
  if (isTimeoutError(originalError)) {
    attempt.shrink = createSkippedShrink(initialValues)
    return
  }
  const failure = getFailureKey(originalError)
  const seed = attempt.seed
  if (!failure || !seed || !initial.length) {
    return
  }
  const start = now()
  // each run sets the repeat of the failed attempt
  const repeatCount = test.result!.repeatCount
  const runTimeout = getHiddenRunTimeout(attempt)
  let lastYield = start
  let progress: TaskShrinkProgress = { runs: 0, values: initialValues, initialValues }
  updateTask('test-shrink', test, runner, { shrink: progress })

  const runInput = async (
    streams: RandomTapeStream[],
    { timeout, onCall }: { timeout?: number; onCall?: (call: RandomCall) => void },
  ) => {
    // a read after the end of the input stops the run, because the search does not keep it
    const input = new RandomTape({ streams, maxExtraReads: 0, onCall })
    const { failed, errors, slow } = await runHiddenAttempt(test, runner, attempt, input, timeout)
    const same = failed && getFailureKey(errors[0]) === failure
    // the main process shows the progress, and a test that never waits would not receive a cancel
    if (now() - lastYield > YIELD_INTERVAL) {
      updateTask('test-shrink', test, runner, { shrink: progress })
      await new Promise((resolve) => setTimeout(resolve))
      lastYield = now()
    }
    return { same, slow, errors, records: input.getRecords() }
  }

  setShrinkSearchRun(test, true)
  const result = await shrinkTape(
    initial,
    (streams) => runInput(streams, { timeout: runTimeout }),
    {
      now,
      deadline,
      shouldStop: () => test.context.signal.reason instanceof TestRunAbortError,
      onProgress: ({ runs, values }) => {
        progress = { runs, values, initialValues }
      },
    },
  ).finally(() => setShrinkSearchRun(test, false))
  const cancelled = test.context.signal.reason instanceof TestRunAbortError
  // 1 more run of the smallest input reports its errors, logs and random calls
  const values = new FinalRunValues()
  const final = await runInput(result.records, { onCall: (call) => values.add(call) })
  test.result!.repeatCount = repeatCount
  attempt.shrink = {
    tape: result.shrunk ? encodeRandomTape(result.records) : undefined,
    shrunk: result.shrunk,
    timedOut: result.timedOut,
    originalError: originalError && formatErrorLine(originalError),
    values: countValues(result.records),
    initialValues,
    runs: result.runs + 1,
    duration: now() - start,
    calls: values.getCalls(),
    callCount: values.count,
    reproduced: final.same,
  }
  if (cancelled) {
    attempt.shrink.cancelled = true
  }
  if (final.same) {
    // the snapshot review must not save the snapshots of the smallest input
    for (const error of final.errors) {
      delete error.__vitest_error_context__?.meta
    }
    const errors = test.result!.errors ?? []
    for (const [i, run] of runs.entries()) {
      const shownErrors = i === 0 ? final.errors : final.errors.map((error) => ({ ...error }))
      const index = run.errors ? errors.indexOf(run.errors[0]) : -1
      if (run.errors && index !== -1) {
        errors.splice(index, run.errors.length, ...shownErrors)
      }
      run.errors = shownErrors
    }
  }
}

interface ValueLine {
  call: TaskShrinkCall
  simplest: boolean
  kept: boolean
}

// The lines of the random values of the last run. Equal calls at the same place that follow each
// other share 1 line. A fake timer has a line only if the seed changed it. The run keeps at most
// 10 lines that are the simplest values and 10 that are not, because a test can make many calls.
class FinalRunValues {
  count = 0
  private readonly kept: ValueLine[] = []
  private simplestCount = 0
  private otherCount = 0
  private last: ValueLine | undefined

  add(call: RandomCall): void {
    if (call.description && call.simplest) {
      return
    }
    const text = formatRandomCall(call)
    const full = (call.simplest ? this.simplestCount : this.otherCount) >= MAX_SHOWN_CALLS
    const last = this.last
    const sameText = last?.call.text === text
    // the values of `span` and `many` have a label, and a fake timer names its function
    const stack =
      !call.description &&
      call.method !== 'span' &&
      call.method !== 'many' &&
      (!full || (sameText && last.kept))
        ? captureStack()
        : undefined
    if (sameText && (!last.kept || last.call.stack === stack)) {
      last.call.count = (last.call.count ?? 1) + 1
      return
    }
    this.count++
    const line: ValueLine = { call: { text }, simplest: call.simplest, kept: !full }
    if (stack) {
      line.call.stack = stack
    }
    if (line.kept) {
      this.kept.push(line)
      if (call.simplest) {
        this.simplestCount++
      } else {
        this.otherCount++
      }
    }
    this.last = line
  }

  getCalls(): TaskShrinkCall[] {
    if (this.kept.length <= MAX_SHOWN_CALLS) {
      return this.kept.map(({ call }) => call)
    }
    const others = this.kept.filter((line) => !line.simplest)
    const simplest = this.kept.filter((line) => line.simplest)
    const shown = new Set([...others, ...simplest].slice(0, MAX_SHOWN_CALLS))
    return this.kept.filter((line) => shown.has(line)).map(({ call }) => call)
  }
}

function captureStack(): string | undefined {
  const limit = Error.stackTraceLimit
  Error.stackTraceLimit = Math.max(limit, STACK_TRACE_LIMIT)
  try {
    return new Error('STACK_TRACE').stack
  } catch {
    // accessing `.stack` runs `Error.prepareStackTrace`, which can throw
    return undefined
  } finally {
    Error.stackTraceLimit = limit
  }
}

export function getHiddenRunTimeout(attempt: TaskResultAttempt): number {
  return Math.max(MIN_RUN_TIMEOUT, RUN_TIMEOUT_FACTOR * attempt.duration)
}

// A run of the seed of a failed attempt that the report does not show. It returns the errors of
// the run, and the test stays failed.
export async function runHiddenAttempt(
  test: Test,
  runner: VitestRunner,
  attempt: TaskResultAttempt,
  tape: RandomTape,
  timeout: number | undefined,
): Promise<{ failed: boolean; errors: TestError[]; slow: boolean }> {
  const result = test.result!
  const errorsStart = result.errors?.length ?? 0
  startSeedAttempt(test, attempt.seed, tape)
  // the previous run can have aborted the signal
  resetContextSignal(test.context)
  // Force widening to TaskState because TypeScript cannot track mutations made by hooks and the test.
  result.state = 'run' as TaskState
  // the run can wait for an event that does not happen with this input
  let slow = false
  const timer = timeout
    ? setTimeout(() => {
        slow = true
        abortContextSignal(test.context, new Error(`The run took longer than ${timeout}ms.`))
      }, timeout)
    : undefined
  try {
    await runTestAttempt(test, runner, {
      retry: attempt.retryIndex,
      repeats: attempt.repeatIndex,
      shrink: true,
    })
  } finally {
    clearTimeout(timer)
  }
  const failed = result.state === 'fail'
  const errors = result.errors?.splice(errorsStart) ?? []
  result.state = 'fail'
  result.pending = undefined
  result.note = undefined
  return { failed, errors, slow }
}

function createSkippedShrink(values: number): TaskResultShrink {
  return {
    skipped: 'timeout',
    shrunk: false,
    timedOut: false,
    values,
    initialValues: values,
    runs: 0,
    duration: 0,
    calls: [],
    callCount: 0,
    reproduced: false,
  }
}

// the errors are serialized, so they keep only the name of their class
export function isTimeoutError(error: TestError | undefined): boolean {
  return error?.name === 'TestTimeoutError' || error?.name === 'HookTimeoutError'
}

function formatErrorLine(error: TestError): string {
  const line = `${error.name}: ${error.message}`.split('\n')[0]
  return line.length > MAX_ERROR_LINE_LENGTH ? `${line.slice(0, MAX_ERROR_LINE_LENGTH - 1)}…` : line
}

// The same failure has the same error name and the same first stack frame. The message often
// has the random values.
function getFailureKey(error: TestError | undefined): string | undefined {
  if (!error) {
    return undefined
  }
  // a custom error can have a stack that is not a string
  const frame =
    typeof error.stack === 'string'
      ? parseStacktrace(error.stack, { firstOnly: true })[0]
      : undefined
  return frame
    ? `${error.name} ${frame.file}:${frame.line}:${frame.column}`
    : `${error.name} ${error.message}`
}

// A long value shows only its first properties or items. A short text shows only the length of an
// array, because a long array is slow to format.
export function formatRandomCall(
  { path, method, args, result, description }: RandomCall,
  short = false,
): string {
  // fake timers describe what the seed changed, because a timer function returns only an id and
  // the start time is a number
  if (description) {
    return description
  }
  // the fake random functions record their own names, for example `Math.random`
  const source =
    path[0] === 'vitest:globals'
      ? ''
      : `random${path.map((label) => `.fork(${inspect(label)})`).join('')}.`
  // the fakes of `node:crypto` record the arguments that the test left out as `undefined`
  let end = args.length
  while (end > 0 && args[end - 1] === undefined) {
    end--
  }
  const formattedArgs = args
    .slice(0, end)
    .map((arg) => formatRandomCallArgument(arg, short))
    .join(', ')
  const formattedResult = (short && formatLength(result)) || inspect(result, { truncate: 80 })
  return `${source}${method}(${formattedArgs}) → ${formattedResult}`
}

// the result shows the values of a buffer that the call filled
function formatRandomCallArgument(arg: unknown, short: boolean): string {
  return formatLength(arg, short) || inspect(arg, { truncate: 40 })
}

function formatLength(value: unknown, formatsArray = true): string | undefined {
  if (ArrayBuffer.isView(value)) {
    return `${value.constructor.name}(${'length' in value ? value.length : value.byteLength})`
  }
  if (value instanceof ArrayBuffer) {
    return `ArrayBuffer(${value.byteLength})`
  }
  if (formatsArray && Array.isArray(value)) {
    return `Array(${value.length})`
  }
}

import type { RandomTapeMismatch } from '@vitest/utils/random-tape'
import type {
  File,
  TaskResultAttempt,
  TaskResultShrink,
  TaskShrinkCall,
  Test,
} from '../../../runtime/runner/types'
import type {
  FailedSeed,
  SeedDetail,
  TestError,
  TestFailure,
  TestFailureReport,
} from '../../../types/general'
import type { CLIOption } from '../../cli/cli-config'
import type { Vitest } from '../../core'
import { ordinal } from '@vitest/utils/helpers'
import { relative } from 'pathe'
import c from 'tinyrainbow'
import { escapeRegExp } from '../../../utils/base'
import { MAX_SHOWN_TAPE_LENGTH } from '../../../utils/random'
import { countSameFailures, formatErrorAttempts, isSeedReplay } from '../../../utils/tasks'
import { cliOptionsConfig } from '../../cli/cli-config'
import { getShownError, groupTaskErrors } from './failures'
import { F_DOT, F_DOWN_RIGHT } from './figures'
import { formatTime } from './utils'

const MAX_SHOWN_SEEDS = 3
// the keys are aligned like the summary of the run, so a value starts at this column
const VALUE_INDENT = ' '.repeat(13)

// the first seed that failed with the same error on every run
export function getReplaySeed(
  test: Test,
  attempts: (TaskResultAttempt | undefined)[],
): string | undefined {
  const seeds = getSeeds(attempts)
  return seeds.find((seed) => isReproduced(getSeedRuns(test, seed))) ?? seeds[0]
}

function getSeeds(attempts: (TaskResultAttempt | undefined)[]): string[] {
  return [...new Set(attempts.flatMap((attempt) => (attempt?.seed ? [attempt.seed] : [])))]
}

// the first run of the seed, and its replay or retries
function getSeedRuns(test: Test, seed: string): TaskResultAttempt[] {
  return (test.result?.attempts ?? []).filter((run) => run.seed === seed)
}

function isReproduced(runs: TaskResultAttempt[]): boolean {
  return countSameFailures(runs) === runs.length
}

function formatSeedList(seeds: string[]): string {
  const shown = seeds.slice(0, MAX_SHOWN_SEEDS).join(', ')
  const more = seeds.length - MAX_SHOWN_SEEDS
  return more > 0 ? `${shown} and ${more} more` : shown
}

export interface ReplayRun {
  seed: string | undefined
  cliArgs: string[]
}

// in a merged report, each file was tested by the run of its blob
export function getReplayRun(vitest: Vitest, file: File): ReplayRun {
  const blobs = vitest.state.blobs
  if (blobs) {
    return blobs.runByFileId.get(file.id) ?? { seed: undefined, cliArgs: [] }
  }
  return { seed: vitest.getSeed(), cliArgs: vitest._cliArgs }
}

// a merged report has the seed of each blob
export function getRunSeeds(vitest: Vitest): string[] {
  const seeds = vitest.state.blobs?.runs.map(({ seed }) => seed) ?? [vitest.getSeed()]
  return [...new Set(seeds)]
}

export function getFailedSeeds(vitest: Vitest, test: Test): FailedSeed[] {
  const run = getReplayRun(vitest, test.file)
  const failed = (test.result?.attempts ?? []).filter((attempt) => attempt.state === 'fail')
  return getSeeds(failed).map((seed) => {
    const runs = getSeedRuns(test, seed)
    const failedSeed: FailedSeed = {
      seed,
      runs: runs.length,
      reproduced: countSameFailures(runs),
      command: formatReplayCommand(test, seed, run, getReplayTape(runs)),
    }
    const shrink = runs.find((attempt) => attempt.shrink)?.shrink
    const tape = shrink?.reproduced ? shrink.tape : runs.find((attempt) => attempt.tape)?.tape
    if (tape) {
      failedSeed.tape = tape
    }
    if (shrink && !shrink.skipped) {
      failedSeed.shrink = {
        values: [shrink.initialValues, shrink.values],
        runs: shrink.runs,
        duration: shrink.duration,
      }
    }
    return failedSeed
  })
}

// 1 failure can have many seeds. Its error and its replay command are from the replay seed.
export function getSeedDetails(
  vitest: Vitest,
  test: Test,
  attempts: (TaskResultAttempt | undefined)[],
  replaySeed: string,
): SeedDetail[] {
  const seeds = [replaySeed, ...getSeeds(attempts).filter((seed) => seed !== replaySeed)]
  const details: SeedDetail[] = []

  const failed = formatFailedRuns(test, attempts)
  if (failed) {
    details.push({ key: 'Failed', value: failed })
  }
  const notReproduced = formatNotReproduced(test, seeds)
  if (notReproduced) {
    details.push({ key: 'Reproduced', value: notReproduced, warning: true })
  }
  const replayRuns = getSeedRuns(test, replaySeed)
  const mismatch = replayRuns.find((attempt) => attempt.tapeMismatch)?.tapeMismatch
  if (mismatch) {
    details.push({
      key: 'Tape',
      value: `does not fit the code: ${formatTapeMismatch(mismatch)}`,
      warning: true,
    })
  }
  const shrunkAttempt = replayRuns.find((attempt) => attempt.shrink)
  const shrink = shrunkAttempt?.shrink
  if (shrink) {
    details.push(
      ...getShrinkDetails(shrink, replaySeed, shrunkAttempt.errors?.[0], vitest.config.root),
    )
  }
  const run = getReplayRun(vitest, test.file)
  const command = formatReplayCommand(test, replaySeed, run, getReplayTape(replayRuns))
  // `Keep` and the command have no tape that is too long to print
  if (shrink?.reproduced && shrink.tape && !getPrintedTape(shrink)) {
    details.push({
      key: 'Replay',
      value: `${command}\nthe tape of the smallest input has ${shrink.tape.length} characters, so the command searches again`,
      copy: command,
    })
  } else {
    details.push({ key: 'Replay', value: command })
  }
  return details
}

// the count of runs of a test with repeats that failed, and the kept seeds among them
function formatFailedRuns(
  test: Test,
  attempts: (TaskResultAttempt | undefined)[],
): string | undefined {
  const repeats = test.result?.repeats
  if (!repeats) {
    return undefined
  }
  const failed = new Set(
    attempts.flatMap((attempt) =>
      attempt && !isSeedReplay(test, attempt.retryIndex) ? [attempt.repeatIndex] : [],
    ),
  )
  const count = `${failed.size} of ${repeats.startTimes.length} runs`
  const kept = repeats.seeds.filter((_, index) => failed.has(index))
  if (!kept.length) {
    return count
  }
  return `${count}: ${kept.length > 1 ? 'kept seeds' : 'kept seed'} ${formatSeedList(kept)}`
}

// a warning if a seed did not fail again in the same way
function formatNotReproduced(test: Test, seeds: string[]): string | undefined {
  const runs = seeds.map((seed) => getSeedRuns(test, seed))
  const unstable = seeds.filter((_, i) => !isReproduced(runs[i]))
  if (!unstable.length) {
    return undefined
  }
  if (seeds.length > 1) {
    const checked = runs.filter((seedRuns) => seedRuns.length > 1).length
    return `no for ${unstable.length} of ${checked} seeds (${formatSeedList(unstable)}), so the test depends on more than its seeds`
  }
  const [first, ...others] = runs[0]
  const index = others.findIndex((run) => countSameFailures([first, run]) < 2)
  const run = `the ${ordinal(index + 2)} run`
  const other = others[index]
  if (other.state !== 'fail') {
    const outcome = other.state === 'skip' ? 'was skipped' : 'passed'
    return `no, ${run} ${outcome}, so the test depends on more than its seed`
  }
  const error = other.errors?.[0]
  return [
    `no, ${run} failed with another error, so the test depends on more than its seed`,
    ...(error ? [`${error.name}: ${error.message}`.split('\n')[0]] : []),
  ].join('\n')
}

// the `Tapes` row of the summary: replays of `--replay-seed <seed>:<tape>` that passed, and tapes
// that do not fit the code any more
export function renderTapeSummary(vitest: Vitest, tests: Test[]): string[] {
  const replayTape = vitest.config.replayTape
  const passed = new Map<string, string[]>()
  const notFitting = new Map<string, string[]>()
  for (const test of tests) {
    const attempts = test.result?.attempts ?? []
    const replay = replayTape ? attempts.find((attempt) => attempt.tape === replayTape) : undefined
    if (replay) {
      if (test.result?.state === 'pass' && replay.tapeMismatch) {
        addTapeNote(
          notFitting,
          test,
          `${test.fullTestName}: ${formatTapeCounts(replay.tapeMismatch)}`,
        )
      } else if (test.result?.state === 'pass') {
        addTapeNote(passed, test, test.fullTestName)
      }
      continue
    }
    const seeds = new Set<string>()
    for (const { state, seed, tapeMismatch } of attempts) {
      if (state === 'pass' && seed && tapeMismatch && !seeds.has(seed)) {
        seeds.add(seed)
        addTapeNote(
          notFitting,
          test,
          `${test.fullTestName} (${seed}): ${formatTapeCounts(tapeMismatch)}`,
        )
      }
    }
  }
  const lines: string[] = []
  if (passed.size) {
    lines.push(
      c.bold(c.yellow(`${countTapeNotes(passed)} passed with the same random values`)),
      ...renderTapeNotes(passed),
      c.dim('the bug can be fixed'),
    )
  }
  if (notFitting.size) {
    const count = countTapeNotes(notFitting)
    lines.push(
      c.bold(c.yellow(`${count} ${count === 1 ? 'does' : 'do'} not fit the code`)),
      ...renderTapeNotes(notFitting),
      c.dim('the code changed after the search, so the tape does not test the original input'),
    )
  }
  return lines
}

function addTapeNote(notes: Map<string, string[]>, test: Test, note: string): void {
  const file = test.file.name
  notes.set(file, [...(notes.get(file) ?? []), note])
}

function countTapeNotes(notes: Map<string, string[]>): number {
  return [...notes.values()].reduce((count, tests) => count + tests.length, 0)
}

// the same layout as obsolete snapshots
function renderTapeNotes(notes: Map<string, string[]>): string[] {
  return [...notes].flatMap(([file, tests]) => [
    `${c.gray(F_DOWN_RIGHT)} ${file}`,
    ...tests.map((test) => `  ${c.gray(F_DOT)} ${test}`),
  ])
}

function formatTapeMismatch({ read, recorded }: RandomTapeMismatch): string {
  return `the test read ${read} random values, and the tape has ${recorded}`
}

function formatTapeCounts({ read, recorded }: RandomTapeMismatch): string {
  return `read ${read} random values, the tape has ${recorded}`
}

function getShrinkDetails(
  shrink: TaskResultShrink,
  seed: string,
  shownError: TestError | undefined,
  root: string,
): SeedDetail[] {
  if (shrink.skipped === 'timeout') {
    return [{ key: 'Shrunk', value: 'not tried, because the test timed out' }]
  }
  const stop = shrink.timedOut ? ', at the time limit' : shrink.cancelled ? ', cancelled' : ''
  const time = `${shrink.runs} runs (${formatTime(shrink.duration)}${stop})`
  if (!shrink.shrunk) {
    return [{ key: 'Shrunk', value: `no smaller input fails in the same way in ${time}` }]
  }
  const size =
    shrink.values < shrink.initialValues
      ? `from ${shrink.initialValues} to ${shrink.values} random values`
      : 'to smaller random values'
  if (!shrink.reproduced) {
    return [
      {
        key: 'Shrunk',
        value: `${size} in ${time}, but the smallest input did not fail again in the same way`,
        warning: true,
      },
    ]
  }
  const details: SeedDetail[] = []
  // the error above comes from the smallest input
  const shown = shownError && `${shownError.name}: ${shownError.message}`.split('\n')[0]
  if (shrink.originalError && !shown?.startsWith(shrink.originalError.replace(/…$/, ''))) {
    details.push({ key: 'Original', value: shrink.originalError })
  }
  details.push({ key: 'Shrunk', value: `${size} in ${time}` })
  if (shrink.callCount) {
    const lines = shrink.calls.map((call) => formatShrinkCall(call, root))
    const more = shrink.callCount - shrink.calls.length
    details.push({
      key: 'Values',
      value: (more > 0 ? [...lines, `and ${more} more`] : lines).join('\n'),
    })
  }
  const tape = getPrintedTape(shrink)
  // the test option that runs the smallest input on every run
  details.push({ key: 'Keep', value: `seeds: ['${tape ? `${seed}:${tape}` : seed}']` })
  return details
}

function formatShrinkCall({ text, location, count }: TaskShrinkCall, root: string): string {
  const place = location
    ? ` (${relative(root, location.file)}:${location.line}:${location.column})`
    : ''
  return count && count > 1 ? `${text}${place}, ${count} times` : `${text}${place}`
}

// the tape of the smallest input that failed again in the same way, if it is short enough
function getPrintedTape(shrink: TaskResultShrink): string | undefined {
  if (shrink.reproduced && shrink.tape && shrink.tape.length <= MAX_SHOWN_TAPE_LENGTH) {
    return shrink.tape
  }
}

// the tape of the smallest input, or the tape of `seeds` or `--replay-seed`, if it
// is short enough
function getReplayTape(runs: TaskResultAttempt[]): string | undefined {
  const shrink = runs.find((attempt) => attempt.shrink)?.shrink
  if (shrink?.tape) {
    return getPrintedTape(shrink)
  }
  const tape = runs.find((attempt) => attempt.tape)?.tape
  return tape && tape.length <= MAX_SHOWN_TAPE_LENGTH ? tape : undefined
}

export function getTestFailureReport(vitest: Vitest, test: Test): TestFailureReport {
  const failures = groupTaskErrors([test]).map((group): TestFailure => {
    const attempts = group.sources.map(({ attempt }) => attempt)
    const replaySeed = getReplaySeed(test, attempts)
    const error = getShownError(group, replaySeed)
    const runs = formatErrorAttempts(test, attempts)
    if (!replaySeed) {
      return { error, details: runs ? [{ key: 'Failed', value: runs }] : [] }
    }
    // the UI also lists the runs and the seeds that the terminal only counts
    const details = getSeedDetails(vitest, test, attempts, replaySeed)
    const seeds = [replaySeed, ...getSeeds(attempts).filter((seed) => seed !== replaySeed)]
    details.splice(
      details[0].key === 'Failed' ? 1 : 0,
      0,
      ...(runs ? [{ key: 'Runs' as const, value: runs }] : []),
      { key: seeds.length > 1 ? 'Seeds' : 'Seed', value: seeds.join(', ') },
    )
    return { error, details }
  })
  return { failures, failedSeeds: getFailedSeeds(vitest, test) }
}

// the details of all failed seeds of a test
export function getTestSeedDetails(vitest: Vitest, test: Test): SeedDetail[] {
  const failed = (test.result?.attempts ?? []).filter((attempt) => attempt.state === 'fail')
  const replaySeed = getReplaySeed(test, failed)
  return replaySeed ? getSeedDetails(vitest, test, failed, replaySeed) : []
}

export function formatSeedDetails(details: SeedDetail[]): string {
  return details
    .map(({ key, value }) => `${key.padStart(11)}  ${indentSeedDetail(value)}`)
    .join('\n')
}

// the next lines of a value start under its first line
export function indentSeedDetail(value: string): string {
  return value.replaceAll('\n', `\n${VALUE_INDENT}`)
}

function formatReplayCommand(test: Test, seed: string, run: ReplayRun, tape?: string): string {
  const args = ['vitest', 'run', quote(test.file.name)]
  args.push('-t', quote(`^${escapeRegExp(test.fullTestName)}$`))
  if (test.file.projectName) {
    args.push('--project', quote(test.file.projectName))
  }
  args.push(...getReplayArgs(run.cliArgs).map(quote))
  // fixtures of file and worker scope and suite hooks get their values from the run seed
  if (run.seed != null) {
    args.push('--seed', quote(run.seed))
  }
  args.push('--replay-seed', tape ? `${seed}:${tape}` : seed)
  return args.join(' ')
}

// the replay command selects the test and sets the seeds itself, and it does not write reports,
// check coverage or update snapshots
const REPLACED_OPTIONS = new Set([
  'testNamePattern',
  'project',
  'shard',
  'changed',
  'sinceLastRun',
  'lastFailed',
  'seed',
  'repeats',
  'replaySeed',
  'watch',
  'run',
  'standalone',
  'mergeReports',
  'reporters',
  'outputFile',
  'ui',
  'open',
  'api',
  'coverage',
  'update',
])

interface CliFlag {
  option: string
  hasValue: boolean
}

let cliFlags: Map<string, CliFlag> | undefined

function getReplayArgs(cliArgs: string[]): string[] {
  const flags = (cliFlags ??= getCliFlags(cliOptionsConfig))
  const args: string[] = []
  for (let i = 0; i < cliArgs.length; i++) {
    const arg = cliArgs[i]
    if (arg === '--') {
      break
    }
    // the command name and the file filters
    if (!arg.startsWith('-')) {
      continue
    }
    const [name, value] = arg.split(/=(.*)/s)
    // options like `--outputFile.json` have no subcommands in the CLI config
    let flag = flags.get(camelCase(name)) ?? flags.get(camelCase(name.split('.')[0]))
    const negated = !flag && name.startsWith('--no-')
    if (negated) {
      flag = flags.get(camelCase(`--${name.slice(5)}`))
    }
    const next = cliArgs[i + 1]
    // an unknown flag takes the next value, as in `mri`
    const hasValue = !negated && value === undefined && (flag?.hasValue ?? true)
    const tokens =
      hasValue && next !== undefined && !next.startsWith('-') ? [arg, cliArgs[++i]] : [arg]
    if (!flag || !REPLACED_OPTIONS.has(flag.option)) {
      args.push(...tokens)
    }
  }
  return args
}

function getCliFlags(
  options: Record<string, CLIOption<any> | null>,
  flags = new Map<string, CliFlag>(),
  prefix = '',
  root?: string,
): Map<string, CliFlag> {
  for (const [key, option] of Object.entries(options)) {
    if (!option) {
      continue
    }
    const name = prefix + (option.alias || key)
    const flag = { option: root ?? key, hasValue: 'argument' in option && !!option.argument }
    flags.set(camelCase(`--${name}`), flag)
    if (option.shorthand) {
      flags.set(`-${option.shorthand}`, flag)
    }
    if ('subcommands' in option && option.subcommands) {
      getCliFlags(option.subcommands, flags, `${name}.`, root ?? key)
    }
  }
  return flags
}

// `cac` accepts both `--test-name-pattern` and `--testNamePattern`
function camelCase(flag: string): string {
  return flag.replace(/([a-z])-([a-z])/g, (_, before: string, after: string) => {
    return before + after.toUpperCase()
  })
}

function quote(value: string): string {
  if (/^[\w./@:=,-]+$/.test(value)) {
    return value
  }
  // PowerShell expands `$name` inside double quotes, its escape character is a backtick
  if (process.platform === 'win32') {
    return `"${value.replace(/[`"$]/g, '`$&')}"`
  }
  return `'${value.replace(/'/g, `'\\''`)}'`
}

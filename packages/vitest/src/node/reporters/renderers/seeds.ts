import type { File, TaskResultAttempt, Test } from '../../../runtime/runner/types'
import type { SeedDetail } from '../../../types/general'
import type { CLIOption } from '../../cli/cli-config'
import type { Vitest } from '../../core'
import { escapeRegExp } from '../../../utils/base'
import { countSameFailures, formatErrorAttempts } from '../../../utils/tasks'
import { cliOptionsConfig } from '../../cli/cli-config'

const MAX_SHOWN_SEEDS = 3

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

interface ReplayRun {
  seed: string | undefined
  cliArgs: string[]
}

// in a merged report, each file was tested by the run of its blob
function getReplayRun(vitest: Vitest, file: File): ReplayRun {
  const blobs = vitest.state.blobs
  if (blobs) {
    return blobs.runByFileId.get(file.id) ?? { seed: undefined, cliArgs: [] }
  }
  return { seed: vitest.getSeed(), cliArgs: vitest._cliArgs }
}

// 1 failure can have many seeds. Its error and its replay command are from the replay seed.
export function getSeedDetails(
  vitest: Vitest,
  test: Test,
  attempts: (TaskResultAttempt | undefined)[],
  replaySeed: string,
  otherMessages = false,
): SeedDetail[] {
  const seeds = [replaySeed, ...getSeeds(attempts).filter((seed) => seed !== replaySeed)]
  const runs = seeds.map((seed) => getSeedRuns(test, seed))
  const unstable = seeds.filter((_, i) => countSameFailures(runs[i]) < runs[i].length)
  const checked = runs.filter((seedRuns) => seedRuns.length > 1).length
  const details: SeedDetail[] = []

  const failed = formatErrorAttempts(test, attempts)
  if (failed) {
    details.push({ key: 'Failed', value: failed })
  }
  const shownSeed = otherMessages ? `${replaySeed} (this error)` : replaySeed
  details.push({
    key: seeds.length > 1 ? 'Seeds' : 'Seed',
    value: formatSeedList([shownSeed, ...seeds.slice(1)]),
  })
  if (checked) {
    const reproduced =
      seeds.length === 1
        ? `${countSameFailures(runs[0])} of ${runs[0].length} runs`
        : `${checked - unstable.length} of ${checked} seeds`
    if (unstable.length) {
      const others = seeds.length > 1 ? `, not ${formatSeedList(unstable)}` : ''
      const depends = seeds.length > 1 ? 'its seeds' : 'its seed'
      details.push({
        key: 'Reproduced',
        value: `${reproduced}${others}: the test depends on more than ${depends}`,
        warning: true,
      })
    } else {
      details.push({ key: 'Reproduced', value: reproduced })
    }
  }
  const run = getReplayRun(vitest, test.file)
  details.push({ key: 'Replay', value: formatReplayCommand(test, replaySeed, run) })
  return details
}

function formatReplayCommand(test: Test, seed: string, run: ReplayRun): string {
  const args = ['vitest', 'run', quote(test.file.name)]
  args.push('-t', quote(`^${escapeRegExp(test.fullTestName)}$`))
  if (test.file.projectName) {
    args.push('--project', quote(test.file.projectName))
  }
  args.push(...getReplayArgs(run.cliArgs).map(quote))
  // fixtures of file and worker scope and suite hooks get their values from the run seed
  if (run.seed != null) {
    args.push('--seed', String(run.seed))
  }
  args.push('--replay-seed', seed)
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

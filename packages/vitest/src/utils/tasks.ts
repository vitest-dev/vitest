// this file is imported by the runner (that runs in a separate threads), by the ast collector,
// by the state manager, and by other APIs that rely on the structure,
// so it is important to keep it small and not rely on any Node APIs

import type { Arrayable, TestError } from '@vitest/utils'
import type {
  File,
  Suite,
  Task,
  TaskBase,
  TaskEventPack,
  TaskResultAttempt,
  TaskResultPack,
  Test,
} from '../runtime/runner/types'
import { ordinal, toArray } from '@vitest/utils/helpers'
import { relative } from 'pathe'

/* @__NO_SIDE_EFFECTS__ */
export function isTestCase(s: Task): s is Test {
  return s.type === 'test'
}

/* @__NO_SIDE_EFFECTS__ */
export function getTests(suite: Arrayable<Task>): Test[] {
  const tests: Test[] = []
  const arraySuites = toArray(suite)
  for (const s of arraySuites) {
    if (isTestCase(s)) {
      tests.push(s)
    } else {
      for (const task of s.tasks) {
        if (isTestCase(task)) {
          tests.push(task)
        } else {
          const taskTests = getTests(task)
          for (const test of taskTests) {
            tests.push(test)
          }
        }
      }
    }
  }
  return tests
}

/* @__NO_SIDE_EFFECTS__ */
export function getTasks(tasks: Arrayable<Task> = []): Task[] {
  return toArray(tasks).flatMap((s) => (isTestCase(s) ? [s] : [s, ...getTasks(s.tasks)]))
}

/* @__NO_SIDE_EFFECTS__ */
export function getSuites(suite: Arrayable<Task>): Suite[] {
  return toArray(suite).flatMap((s) => (s.type === 'suite' ? [s, ...getSuites(s.tasks)] : []))
}

/* @__NO_SIDE_EFFECTS__ */
export function hasFailed(suite: Arrayable<Task>): boolean {
  return toArray(suite).some(
    (s) => s.result?.state === 'fail' || (s.type === 'suite' && hasFailed(s.tasks)),
  )
}

/* @__NO_SIDE_EFFECTS__ */
export function getNames(task: Task): string[] {
  const names = [task.name]
  let current: Task | undefined = task

  while (current?.suite) {
    current = current.suite
    if (current?.name) {
      names.unshift(current.name)
    }
  }

  if (current !== task.file) {
    names.unshift(task.file.name)
  }

  return names
}

/* @__NO_SIDE_EFFECTS__ */
export function getFullName(task: Task, separator = ' > '): string {
  return getNames(task).join(separator)
}

/* @__NO_SIDE_EFFECTS__ */
export function getTestName(task: Task, separator = ' > '): string {
  return getNames(task).slice(1).join(separator)
}

/* @__NO_SIDE_EFFECTS__ */
export function createTaskName(names: readonly (string | undefined)[], separator = ' > '): string {
  return names.filter((name) => name !== undefined).join(separator)
}

/* @__NO_SIDE_EFFECTS__ */
export function isSnapshotMatchError(error: TestError | undefined): error is TestError {
  return typeof error?.message === 'string' && /Snapshot .* mismatched/.test(error.message)
}

// the runs of a seed that failed with the same error as its first run
export function countSameFailures(runs: TaskResultAttempt[]): number {
  const error = runs[0]?.errors?.[0]
  return runs.filter(
    ({ state, errors }) =>
      state === 'fail' &&
      errors?.[0]?.name === error?.name &&
      errors?.[0]?.message === error?.message,
  ).length
}

export function getRetryCount(retry: number | { count?: number } | undefined): number {
  if (retry === undefined) {
    return 0
  }
  if (typeof retry === 'number') {
    return retry
  }
  return retry.count ?? 0
}

// without `retry`, a failed repeat that used its seed runs 1 more time to check that it fails again
export function isRepeatReplay(test: Test, retryIndex: number): boolean {
  return !!test.repeats && retryIndex > 0 && !getRetryCount(test.retry)
}

/* @__NO_SIDE_EFFECTS__ */
export function hasFailedSnapshot(suite: Arrayable<Task>): boolean {
  return getTests(suite).some((s) => {
    return s.result?.errors?.some(isSnapshotMatchError)
  })
}

/* @__NO_SIDE_EFFECTS__ */
export function convertTasksToEvents(
  file: File,
  onTask?: (task: Task) => void,
): {
  packs: TaskResultPack[]
  events: TaskEventPack[]
} {
  const packs: TaskResultPack[] = []
  const events: TaskEventPack[] = []

  function visit(suite: Suite | File) {
    onTask?.(suite)

    packs.push([suite.id, suite.result, suite.meta])
    events.push([suite.id, 'suite-prepare', undefined])
    suite.tasks.forEach((task) => {
      if (task.type === 'suite') {
        visit(task)
      } else {
        onTask?.(task)
        if (suite.mode !== 'skip' && suite.mode !== 'todo') {
          packs.push([task.id, task.result, task.meta])
          events.push([task.id, 'test-prepare', undefined])
          task.annotations.forEach((annotation) => {
            events.push([task.id, 'test-annotation', { annotation }])
          })
          task.artifacts.forEach((artifact) => {
            events.push([task.id, 'test-artifact', { artifact }])
          })
          events.push([task.id, 'test-finished', undefined])
        }
      }
    })
    events.push([suite.id, 'suite-finished', undefined])
  }

  visit(file)

  return { packs, events }
}

interface HashMeta {
  typecheck?: boolean
  __vitest_label__?: string
}

/* @__NO_SIDE_EFFECTS__ */
export function createFileTask(
  filepath: string,
  root: string,
  projectName: string | undefined,
  pool?: string,
  viteEnvironment?: string,
  meta?: HashMeta,
): File {
  const path = relative(root, filepath)
  // this can be called outside of the test run, so worker might not be there
  // @ts-expect-error injected global
  const workerState = globalThis.__vitest_worker__
  const file: File = {
    id: generateFileHash(path, projectName, meta),
    name: path,
    fullName: path,
    type: 'suite',
    mode: 'queued',
    filepath,
    tasks: [],
    meta: Object.assign(Object.create(null), meta),
    projectName,
    file: undefined!,
    pool,
    viteEnvironment,
    concurrencyId: workerState?.ctx.concurrencyId ?? 0,
    workerId: workerState?.ctx.workerId ?? 0,
  }
  file.file = file
  return file
}

/**
 * Generate a unique ID for a file based on its path and project name
 * @param file File relative to the root of the project to keep ID the same between different machines
 * @param projectName The name of the test project
 */
/* @__NO_SIDE_EFFECTS__ */
export function generateFileHash(
  file: string,
  projectName: string | undefined,
  meta?: HashMeta,
): string {
  const seed = [
    file,
    projectName || '',
    meta?.typecheck ? '__typecheck__' : '',
    meta?.__vitest_label__ || '',
  ].join('\0')
  return generateHash(seed)
}

/* @__NO_SIDE_EFFECTS__ */
export function generateHash(str: string): string {
  let hash = 0
  if (str.length === 0) {
    return `${hash}`
  }
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return `${hash}`
}

export function calculateSuiteHash(parent: Suite): void {
  parent.tasks.forEach((t, idx) => {
    t.id = `${parent.id}_${idx}`
    if (t.type === 'suite') {
      calculateSuiteHash(t)
    }
  })
}

/**
 * If any tasks been marked as `only`, mark all other tasks as `skip`.
 */
export function interpretTaskModes(
  file: Suite,
  namePattern?: string | RegExp,
  testLocations?: number[] | undefined,
  testIds?: string[] | undefined,
  testNames?: string[] | undefined,
  testTagsFilter?: ((testTags: string[]) => boolean) | undefined,
  onlyMode?: boolean,
  parentIsOnly?: boolean,
  allowOnly?: boolean,
): void {
  const matchedLocations: number[] = []
  const testLocationsSet =
    testLocations !== undefined && testLocations.length !== 0 ? new Set(testLocations) : undefined
  const testIdsSet = testIds ? new Set(testIds) : undefined
  const testNamesSet = testNames ? new Set(testNames) : undefined

  const traverseSuite = (
    suite: Suite,
    parentIsOnly?: boolean,
    parentMatchedWithLocation?: boolean,
  ) => {
    const suiteIsOnly = parentIsOnly || suite.mode === 'only'

    // Check if any tasks in this suite have `.only` - if so, only those should run.
    // `containsOnly` is computed during collection (in the runtime/AST collectors).
    const hasSomeTasksOnly = !!(onlyMode && suite.containsOnly)

    suite.tasks.forEach((t) => {
      // Check if either the parent suite or the task itself are marked as included
      // If there are tasks with `.only` in this suite, only include those (not all tasks from describe.only)
      const includeTask = hasSomeTasksOnly
        ? t.mode === 'only' || (t.type === 'suite' && !!t.containsOnly)
        : suiteIsOnly || t.mode === 'only'
      if (onlyMode) {
        if (t.type === 'suite' && (includeTask || t.containsOnly)) {
          // Don't skip this suite
          if (t.mode === 'only') {
            checkAllowOnly(t, allowOnly)
            t.mode = 'run'
          }
        } else if (t.mode === 'run' && !includeTask) {
          t.mode = 'skip'
        } else if (t.mode === 'only') {
          checkAllowOnly(t, allowOnly)
          t.mode = 'run'
        }
      }

      let hasLocationMatch = parentMatchedWithLocation
      // Match test location against provided locations, only run if present
      // in `testLocations`. Note: if `includeTaskLocation` is not enabled,
      // all test will be skipped.
      if (testLocationsSet !== undefined) {
        if (t.location && testLocationsSet.has(t.location.line)) {
          t.mode = 'run'
          matchedLocations.push(t.location.line)
          hasLocationMatch = true
        } else if (parentMatchedWithLocation) {
          t.mode = 'run'
        } else if (t.type === 'test') {
          t.mode = 'skip'
        }
      }

      if (t.type === 'test') {
        // oxlint-disable-next-line unicorn/prefer-regexp-test -- namePattern can be a string
        if (namePattern && !t.fullTestName.match(namePattern)) {
          t.mode = 'skip'
        }
        if (testIdsSet && !testIdsSet.has(t.id)) {
          t.mode = 'skip'
        }
        if (testNamesSet && !testNamesSet.has(t.fullTestName)) {
          t.mode = 'skip'
        }
        if (testTagsFilter && !testTagsFilter(t.tags || [])) {
          t.mode = 'skip'
        }
      } else if (t.type === 'suite') {
        if (t.mode === 'skip') {
          skipAllTasks(t)
        } else if (t.mode === 'todo') {
          todoAllTasks(t)
        } else {
          traverseSuite(t, includeTask, hasLocationMatch)
        }
      }
    })

    // if all subtasks are skipped, mark as skip
    if (suite.mode === 'run' || suite.mode === 'queued') {
      if (suite.tasks.length && suite.tasks.every((i) => i.mode !== 'run' && i.mode !== 'queued')) {
        suite.mode = 'skip'
      }
    }
  }

  traverseSuite(file, parentIsOnly, false)

  const nonMatching = testLocations?.filter((loc) => !matchedLocations.includes(loc))
  if (nonMatching && nonMatching.length !== 0) {
    const message =
      nonMatching.length === 1 ? `line ${nonMatching[0]}` : `lines ${nonMatching.join(', ')}`

    if (file.result === undefined) {
      file.result = {
        state: 'fail',
        errors: [],
      }
    }
    if (file.result.errors === undefined) {
      file.result.errors = []
    }

    const error = new Error(`No test found in ${file.name} in ${message}`)
    file.result.errors.push({
      name: error.name,
      message: error.message,
      stack: error.stack,
    })
  }
}

function skipAllTasks(suite: Suite) {
  suite.tasks.forEach((t) => {
    if (t.mode === 'run' || t.mode === 'queued') {
      t.mode = 'skip'
      if (t.type === 'suite') {
        skipAllTasks(t)
      }
    }
  })
}
function todoAllTasks(suite: Suite) {
  suite.tasks.forEach((t) => {
    if (t.mode === 'run' || t.mode === 'queued') {
      t.mode = 'todo'
      if (t.type === 'suite') {
        todoAllTasks(t)
      }
    }
  })
}

function checkAllowOnly(task: TaskBase, allowOnly?: boolean) {
  if (allowOnly) {
    return
  }
  const error = new Error(
    '[Vitest] Unexpected .only modifier. Remove it or pass --allowOnly argument to bypass this error',
  )
  task.result = {
    state: 'fail',
    errors: [
      {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    ],
  }
}

export function formatErrorAttempts(
  task: Task,
  attempts: (TaskResultAttempt | undefined)[],
): string {
  if (task.type === 'test' && task.result?.repeats) {
    return formatRepeatAttempts(task, attempts)
  }
  const showAttempt = (task.result?.attempts?.length ?? 0) > 1
  return [...Map.groupBy(attempts, (attempt) => attempt)]
    .map(([attempt, occurrences]) => {
      const label = showAttempt && attempt ? formatRetry(task, attempt.retryIndex) : ''
      const count = occurrences.length > 1 ? `${occurrences.length} times` : ''
      return count && label ? `${count} in ${label}` : count || label
    })
    .filter(Boolean)
    .join(', ')
}

const MAX_SHOWN_RANGES = 5

// The runs of 1 seed have 1 label, because the seed line shows if they failed with the same
// error. Other runs have a label for each kind of retry, with the repeats in ranges.
function formatRepeatAttempts(task: Test, attempts: (TaskResultAttempt | undefined)[]): string {
  const seededRepeats = new Set(
    attempts.flatMap((attempt) =>
      attempt?.seed && attempt.retryIndex === 0 ? [attempt.repeatIndex] : [],
    ),
  )
  const groups = Map.groupBy(
    attempts.filter((attempt) => attempt != null),
    (attempt) => (attempt.seed && seededRepeats.has(attempt.repeatIndex) ? 0 : attempt.retryIndex),
  )
  return [...groups]
    .flatMap(([retryIndex, group]) => {
      const repeatIndexes = [...new Set(group.map((attempt) => attempt.repeatIndex))]
      // 1 run can fail with the same error more than 1 time, for example with `expect.soft`
      const count = new Set(group).size === 1 && group.length > 1 ? `${group.length} times in ` : ''
      return formatRepeatRuns(task, retryIndex, repeatIndexes).map((run) => ({
        ...run,
        retryIndex,
        label: count + run.label,
      }))
    })
    .sort((a, b) => a.repeatIndex - b.repeatIndex || a.retryIndex - b.retryIndex)
    .map(({ label }) => label)
    .join(', ')
}

function formatRetry(task: Task, retryIndex: number): string {
  if (task.type === 'test' && isRepeatReplay(task, retryIndex)) {
    return 'replay of initial run'
  }
  return retryIndex ? `${ordinal(retryIndex)} retry` : 'initial run'
}

function formatRepeatRuns(
  task: Test,
  retryIndex: number,
  repeatIndexes: number[],
): { label: string; repeatIndex: number }[] {
  const repeats = repeatIndexes.filter((index) => index > 0).sort((a, b) => a - b)
  const labels =
    repeats.length < repeatIndexes.length
      ? [{ label: formatRetry(task, retryIndex), repeatIndex: 0 }]
      : []
  if (!repeats.length) {
    return labels
  }
  let text = `${ordinal(repeats[0])} repeat`
  if (repeats.length > 1) {
    const ranges: number[][] = []
    for (const index of repeats) {
      const range = ranges.at(-1)
      if (range && range[1] + 1 === index) {
        range[1] = index
      } else {
        ranges.push([index, index])
      }
    }
    const shown = ranges.slice(0, MAX_SHOWN_RANGES)
    const more = repeats.length - shown.reduce((sum, [start, end]) => sum + end - start + 1, 0)
    text = `repeats ${shown.map(([start, end]) => (start === end ? start : `${start}-${end}`)).join(', ')}`
    if (more) {
      text += ` and ${more} more`
    }
  }
  const replay = isRepeatReplay(task, retryIndex) ? 'replay' : ''
  const retry = replay || (retryIndex ? `${ordinal(retryIndex)} retry` : '')
  return [...labels, { label: retry ? `${retry} of ${text}` : text, repeatIndex: repeats[0] }]
}

// this file is imported by the runner (that runs in a separate threads), by the ast collector,
// by the state manager, and by other APIs that rely on the structure,
// so it is important to keep it small and not rely on any Node APIs

import type { Arrayable } from '@vitest/utils'
import type { File, Suite, Task, TaskBase, TaskEventPack, TaskResultPack, Test } from '../runtime/runner/types'
import { toArray } from '@vitest/utils/helpers'
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
    }
    else {
      for (const task of s.tasks) {
        if (isTestCase(task)) {
          tests.push(task)
        }
        else {
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
  return toArray(tasks).flatMap(s =>
    isTestCase(s) ? [s] : [s, ...getTasks(s.tasks)],
  )
}

/* @__NO_SIDE_EFFECTS__ */
export function getSuites(suite: Arrayable<Task>): Suite[] {
  return toArray(suite).flatMap(s =>
    s.type === 'suite' ? [s, ...getSuites(s.tasks)] : [],
  )
}

/* @__NO_SIDE_EFFECTS__ */
export function hasTests(suite: Arrayable<Suite>): boolean {
  return toArray(suite).some(s =>
    s.tasks.some(c => isTestCase(c) || hasTests(c)),
  )
}

/* @__NO_SIDE_EFFECTS__ */
export function hasFailed(suite: Arrayable<Task>): boolean {
  return toArray(suite).some(
    s =>
      s.result?.state === 'fail' || (s.type === 'suite' && hasFailed(s.tasks)),
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
  return names.filter(name => name !== undefined).join(separator)
}

/* @__NO_SIDE_EFFECTS__ */
export function hasBenchmark(suite: Arrayable<Suite>): boolean {
  return toArray(suite).some(s =>
    s?.tasks?.some(c => c.meta?.benchmark || hasBenchmark(c as Suite)),
  )
}

/* @__NO_SIDE_EFFECTS__ */
export function hasFailedSnapshot(suite: Arrayable<Task>): boolean {
  return getTests(suite).some((s) => {
    return s.result?.errors?.some(
      e =>
        typeof e?.message === 'string'
        && e.message.match(/Snapshot .* mismatched/),
    )
  })
}

/* @__NO_SIDE_EFFECTS__ */
export function convertTasksToEvents(file: File, onTask?: (task: Task) => void): {
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
      }
      else {
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
  testTagsFilter?: ((testTags: string[]) => boolean) | undefined,
  onlyMode?: boolean,
  parentIsOnly?: boolean,
  allowOnly?: boolean,
): void {
  const matchedLocations: number[] = []
  const testLocationsSet = testLocations !== undefined && testLocations.length !== 0
    ? new Set(testLocations)
    : undefined
  const testIdsSet = testIds ? new Set(testIds) : undefined

  const traverseSuite = (suite: Suite, parentIsOnly?: boolean, parentMatchedWithLocation?: boolean) => {
    const suiteIsOnly = parentIsOnly || suite.mode === 'only'

    // Check if any tasks in this suite have `.only` - if so, only those should run
    const hasSomeTasksOnly = onlyMode && suite.tasks.some(
      t => t.mode === 'only' || (t.type === 'suite' && someTasksAreOnly(t)),
    )

    suite.tasks.forEach((t) => {
      // Check if either the parent suite or the task itself are marked as included
      // If there are tasks with `.only` in this suite, only include those (not all tasks from describe.only)
      const includeTask = hasSomeTasksOnly
        ? (t.mode === 'only' || (t.type === 'suite' && someTasksAreOnly(t)))
        : (suiteIsOnly || t.mode === 'only')
      if (onlyMode) {
        if (t.type === 'suite' && (includeTask || someTasksAreOnly(t))) {
          // Don't skip this suite
          if (t.mode === 'only') {
            checkAllowOnly(t, allowOnly)
            t.mode = 'run'
          }
        }
        else if (t.mode === 'run' && !includeTask) {
          t.mode = 'skip'
        }
        else if (t.mode === 'only') {
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
        }
        else if (parentMatchedWithLocation) {
          t.mode = 'run'
        }
        else if (t.type === 'test') {
          t.mode = 'skip'
        }
      }

      if (t.type === 'test') {
        if (namePattern && !getTaskFullName(t).match(namePattern)) {
          t.mode = 'skip'
        }
        if (testIdsSet && !testIdsSet.has(t.id)) {
          t.mode = 'skip'
        }
        if (testTagsFilter && !testTagsFilter(t.tags || [])) {
          t.mode = 'skip'
        }
      }
      else if (t.type === 'suite') {
        if (t.mode === 'skip') {
          skipAllTasks(t)
        }
        else if (t.mode === 'todo') {
          todoAllTasks(t)
        }
        else {
          traverseSuite(t, includeTask, hasLocationMatch)
        }
      }
    })

    // if all subtasks are skipped, mark as skip
    if (suite.mode === 'run' || suite.mode === 'queued') {
      if (suite.tasks.length && suite.tasks.every(i => i.mode !== 'run' && i.mode !== 'queued')) {
        suite.mode = 'skip'
      }
    }
  }

  traverseSuite(file, parentIsOnly, false)

  const nonMatching = testLocations?.filter(loc => !matchedLocations.includes(loc))
  if (nonMatching && nonMatching.length !== 0) {
    const message = nonMatching.length === 1
      ? `line ${nonMatching[0]}`
      : `lines ${nonMatching.join(', ')}`

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

function getTaskFullName(task: TaskBase): string {
  return `${task.suite ? `${getTaskFullName(task.suite)} ` : ''}${task.name}`
}

/* @__NO_SIDE_EFFECTS__ */
export function someTasksAreOnly(suite: Suite): boolean {
  return suite.tasks.some(
    t => t.mode === 'only' || (t.type === 'suite' && someTasksAreOnly(t)),
  )
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

import type { ParsedStack } from '@vitest/utils'
import type { File, RunMode, Suite, TaskBase } from '../types/tasks'
import { processError } from '@vitest/utils/error'
import { parseSingleStack } from '@vitest/utils/source-map'
import { relative } from 'pathe'

/**
 * If any tasks been marked as `only`, mark all other tasks as `skip`.
 */
export function interpretTaskModes(
  file: Suite,
  namePattern?: string | RegExp,
  testLocations?: number[] | undefined,
  onlyMode?: boolean,
  parentIsOnly?: boolean,
  allowOnly?: boolean,
): void {
  const matchedLocations: number[] = []
  const testLocationsSet = testLocations?.length ? new Set(testLocations) : undefined

  const traverseSuite = (suite: Suite, parentIsOnly = false, parentMatchedWithLocation = false): void => {
    const suiteIsOnly = parentIsOnly || suite.mode === 'only'

    // Pre-compute which tasks have `.only` set (directly or in nested suites)
    // This avoids calling someTasksAreOnly multiple times for the same task
    let hasOnlyChild: Map<Suite, boolean> | undefined
    if (onlyMode) {
      hasOnlyChild = new Map()
      for (const task of suite.tasks) {
        if (task.type === 'suite') {
          hasOnlyChild.set(task, someTasksAreOnly(task))
        }
      }
    }

    // Check if any direct children have `.only` - if so, only those should run
    const hasSomeTasksOnly = hasOnlyChild && suite.tasks.some(
      t => t.mode === 'only' || (t.type === 'suite' && hasOnlyChild.get(t)),
    )

    for (const task of suite.tasks) {
      const taskHasOnlyDescendants = task.type === 'suite' && (hasOnlyChild?.get(task) ?? false)

      // Determine if this task should be included based on `.only` logic
      const includeTask = hasSomeTasksOnly
        ? (task.mode === 'only' || taskHasOnlyDescendants)
        : (suiteIsOnly || task.mode === 'only')

      // Handle `.only` mode
      if (onlyMode) {
        if (task.mode === 'only') {
          checkAllowOnly(task, allowOnly)
          task.mode = 'run'
        }
        else if (task.type === 'suite' && taskHasOnlyDescendants) {
          // Don't skip suites that contain `.only` tasks
        }
        else if (task.mode === 'run' && !includeTask) {
          task.mode = 'skip'
        }
      }

      // Handle test location filtering
      let hasLocationMatch = parentMatchedWithLocation
      if (testLocationsSet) {
        if (task.location && testLocationsSet.has(task.location.line)) {
          task.mode = 'run'
          matchedLocations.push(task.location.line)
          hasLocationMatch = true
        }
        else if (parentMatchedWithLocation) {
          task.mode = 'run'
        }
        else if (task.type === 'test') {
          task.mode = 'skip'
        }
      }

      // Handle name pattern filtering for tests
      if (task.type === 'test') {
        if (namePattern && !getTaskFullName(task).match(namePattern)) {
          task.mode = 'skip'
        }
      }
      else if (task.type === 'suite') {
        // Recurse into suites or propagate skip/todo
        if (task.mode === 'skip') {
          setModeForAllTasks(task, 'skip')
        }
        else if (task.mode === 'todo') {
          setModeForAllTasks(task, 'todo')
        }
        else {
          traverseSuite(task, includeTask, hasLocationMatch)
        }
      }
    }

    // If all subtasks are skipped, mark the suite as skip
    if (suite.mode === 'run' || suite.mode === 'queued') {
      if (suite.tasks.length && suite.tasks.every(t => t.mode !== 'run' && t.mode !== 'queued')) {
        suite.mode = 'skip'
      }
    }
  }

  traverseSuite(file, parentIsOnly, false)

  // Report errors for unmatched test locations
  if (testLocationsSet) {
    const nonMatching = testLocations!.filter(loc => !matchedLocations.includes(loc))
    if (nonMatching.length > 0) {
      const message = nonMatching.length === 1
        ? `line ${nonMatching[0]}`
        : `lines ${nonMatching.join(', ')}`

      file.result ??= { state: 'fail', errors: [] }
      file.result.errors ??= []
      file.result.errors.push(
        processError(new Error(`No test found in ${file.name} in ${message}`)),
      )
    }
  }
}

function getTaskFullName(task: TaskBase): string {
  return `${task.suite ? `${getTaskFullName(task.suite)} ` : ''}${task.name}`
}

export function someTasksAreOnly(suite: Suite): boolean {
  return suite.tasks.some(
    t => t.mode === 'only' || (t.type === 'suite' && someTasksAreOnly(t)),
  )
}

function setModeForAllTasks(suite: Suite, mode: RunMode): void {
  for (const task of suite.tasks) {
    if (task.mode === 'run' || task.mode === 'queued') {
      task.mode = mode
      if (task.type === 'suite') {
        setModeForAllTasks(task, mode)
      }
    }
  }
}

function checkAllowOnly(task: TaskBase, allowOnly?: boolean) {
  if (allowOnly) {
    return
  }
  const error = processError(
    new Error(
      '[Vitest] Unexpected .only modifier. Remove it or pass --allowOnly argument to bypass this error',
    ),
  )
  task.result = {
    state: 'fail',
    errors: [error],
  }
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

export function createFileTask(
  filepath: string,
  root: string,
  projectName: string | undefined,
  pool?: string,
  viteEnvironment?: string,
): File {
  const path = relative(root, filepath)
  const file: File = {
    id: generateFileHash(path, projectName),
    name: path,
    fullName: path,
    type: 'suite',
    mode: 'queued',
    filepath,
    tasks: [],
    meta: Object.create(null),
    projectName,
    file: undefined!,
    pool,
    viteEnvironment,
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
): string {
  return /* @__PURE__ */ generateHash(`${file}${projectName || ''}`)
}

export function findTestFileStackTrace(testFilePath: string, error: string): ParsedStack | undefined {
  // first line is the error message
  const lines = error.split('\n').slice(1)
  for (const line of lines) {
    const stack = parseSingleStack(line)
    if (stack && stack.file === testFilePath) {
      return stack
    }
  }
}

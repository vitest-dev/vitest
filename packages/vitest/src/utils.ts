import { createRequire } from 'module'
import c from 'picocolors'
import type { Suite, Test, Task, Arrayable, Nullable } from './types'

/**
 * Convert `Arrayable<T>` to `Array<T>`
 *
 * @category Array
 */
export function toArray<T>(array?: Nullable<Arrayable<T>>): Array<T> {
  array = array || []
  if (Array.isArray(array))
    return array
  return [array]
}

export function notNullish<T>(v: T | null | undefined): v is NonNullable<T> {
  return v != null
}

export function slash(str: string) {
  return str.replace(/\\/g, '/')
}

/**
 * Partition in tasks groups by consecutive computeMode ('serial', 'concurrent')
 */
export function partitionSuiteChildren(suite: Suite) {
  let tasksGroup: Task[] = []
  const tasksGroups: Task[][] = []
  for (const c of suite.tasks) {
    if (tasksGroup.length === 0 || c.computeMode === tasksGroup[0].computeMode) {
      tasksGroup.push(c)
    }
    else {
      tasksGroups.push(tasksGroup)
      tasksGroup = [c]
    }
  }
  if (tasksGroup.length > 0)
    tasksGroups.push(tasksGroup)

  return tasksGroups
}

/**
 * If any tasks been marked as `only`, mark all other tasks as `skip`.
 */
export function interpretOnlyMode(tasks: Task[]) {
  if (tasks.some(t => t.mode === 'only')) {
    tasks.forEach((t) => {
      if (t.mode === 'run')
        t.mode = 'skip'
      else if (t.mode === 'only')
        t.mode = 'run'
    })
  }
  tasks.forEach((t) => {
    if (t.type === 'suite') {
      if (t.mode === 'skip')
        t.tasks.forEach(c => c.mode === 'run' && (c.mode = 'skip'))
      else
        interpretOnlyMode(t.tasks)
    }
  })
}

export function getTests(suite: Arrayable<Suite>): Test[] {
  return toArray(suite).flatMap(s => s.tasks.flatMap(c => c.type === 'test' ? [c] : getTests(c)))
}

export function getTasks(tasks: Arrayable<Task>): Task[] {
  return toArray(tasks).flatMap(s => s.type === 'test' ? [s] : [s, ...getTasks(s.tasks)])
}

export function getSuites(suite: Arrayable<Task>): Suite[] {
  return toArray(suite).flatMap(s => s.type === 'suite' ? [s, ...getSuites(s.tasks)] : [])
}

export function hasTests(suite: Arrayable<Suite>): boolean {
  return toArray(suite).some(s => s.tasks.some(c => c.type === 'test' || hasTests(c as Suite)))
}

export function hasFailed(suite: Arrayable<Task>): boolean {
  return toArray(suite).some(s => s.result?.state === 'fail' || (s.type === 'suite' && hasFailed(s.tasks)))
}

export function getNames(task: Task) {
  const names = [task.name]
  let current: Task | undefined = task

  while (current?.suite || current?.file) {
    current = current.suite || current.file
    if (current?.name)
      names.unshift(current.name)
  }

  return names
}

export function checkPeerDependency(dependency: string) {
  const require = createRequire(import.meta.url)

  try {
    require.resolve(dependency)
  } catch {
    console.log(c.red(`${c.inverse(c.red(' MISSING DEP '))} Cound not find '${dependency}' peer dependency, please try installing it\n`))
    process.exit(1)
  }
}


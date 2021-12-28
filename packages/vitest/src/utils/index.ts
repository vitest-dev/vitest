import { fileURLToPath, pathToFileURL } from 'url'
import c from 'picocolors'
import { isPackageExists } from 'local-pkg'
import { dirname, resolve } from 'pathe'
import type { Arrayable, Nullable, Suite, Task, Test } from '../types'

export const isWindows = process.platform === 'win32'

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

export function mergeSlashes(str: string) {
  return str.replace(/\/\//g, '/')
}

export const noop = () => {}

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

export function getTests(suite: Arrayable<Task>): Test[] {
  return toArray(suite).flatMap(s => s.type === 'test' ? [s] : s.tasks.flatMap(c => c.type === 'test' ? [c] : getTests(c)))
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

export function getFullName(task: Task) {
  return getNames(task).join(c.dim(' > '))
}

export async function ensurePackageInstalled(
  dependency: string,
  promptInstall = !process.env.CI && process.stdout.isTTY,
) {
  if (isPackageExists(dependency))
    return true

  process.stderr.write(c.red(`${c.inverse(c.red(' MISSING DEP '))} Can not find dependency '${dependency}'\n\n`))

  if (!promptInstall)
    return false

  const prompts = await import('prompts')
  const { install } = await prompts.prompt({
    type: 'confirm',
    name: 'install',
    message: c.reset(`Do you want to install ${c.green(dependency)}?`),
  })

  if (install) {
    await (await import('@antfu/install-pkg')).installPackage(dependency, { dev: true })
    return true
  }

  return false
}

/**
 * Deep merge :P
 */
export function deepMerge<T extends object = object>(target: T, ...sources: any[]): T {
  if (!sources.length)
    return target as any

  const source = sources.shift()
  if (source === undefined)
    return target as any

  if (isMergableObject(target) && isMergableObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isMergableObject(source[key])) {
        // @ts-expect-error
        if (!target[key])
          // @ts-expect-error
          target[key] = {}

        // @ts-expect-error
        deepMerge(target[key], source[key])
      }
      else {
        // @ts-expect-error
        target[key] = source[key]
      }
    })
  }

  return deepMerge(target, ...sources)
}

function isMergableObject(item: any): item is Object {
  return isObject(item) && !Array.isArray(item)
}

export function isObject(val: any): val is object {
  return toString.call(val) === '[object Object]'
}

export function toFilePath(id: string, root: string): string {
  let absolute = slash(id).startsWith('/@fs/')
    ? id.slice(4)
    : id.startsWith(dirname(root))
      ? id
      : id.startsWith('/')
        ? slash(resolve(root, id.slice(1)))
        : id

  if (absolute.startsWith('//'))
    absolute = absolute.slice(1)

  // disambiguate the `<UNIT>:/` on windows: see nodejs/node#31710
  return isWindows && absolute.startsWith('/')
    ? fileURLToPath(pathToFileURL(absolute.slice(1)).href)
    : absolute
}

export { resolve as resolvePath }

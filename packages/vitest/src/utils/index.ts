import { fileURLToPath, pathToFileURL } from 'url'
import c from 'picocolors'
import { isPackageExists } from 'local-pkg'
import { dirname, resolve } from 'pathe'
import type { Suite, Task } from '../types'
import { getNames, slash } from './tasks'

export * from './tasks'

export const isWindows = process.platform === 'win32'

/**
 * Partition in tasks groups by consecutive concurrent
 */
export function partitionSuiteChildren(suite: Suite) {
  let tasksGroup: Task[] = []
  const tasksGroups: Task[][] = []
  for (const c of suite.tasks) {
    if (tasksGroup.length === 0 || c.concurrent === tasksGroup[0].concurrent) {
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

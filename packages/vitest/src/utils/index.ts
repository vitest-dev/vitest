// eslint-disable-next-line no-restricted-imports
import { relative as relativeBrowser } from 'path'
import c from 'picocolors'
import { isPackageExists } from 'local-pkg'
import { relative as relativeNode } from 'pathe'
import type { ModuleCacheMap } from 'vite-node'
import type { Suite, Task } from '../types'
import { EXIT_CODE_RESTART } from '../constants'
import { getWorkerState } from '../utils'
import { getNames } from './tasks'
import { isBrowser, isNode } from './env'

export * from './tasks'
export * from './base'
export * from './global'
export * from './timers'
export * from './env'

export const isWindows = isNode && process.platform === 'win32'
export const getRunMode = () => getWorkerState().config.mode
export const isRunningInTest = () => getRunMode() === 'test'
export const isRunningInBenchmark = () => getRunMode() === 'benchmark'

export const relativePath = isBrowser ? relativeBrowser : relativeNode

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

export function resetModules(modules: ModuleCacheMap, resetMocks = false) {
  const skipPaths = [
    // Vitest
    /\/vitest\/dist\//,
    // yarn's .store folder
    /vitest-virtual-\w+\/dist/,
    // cnpm
    /@vitest\/dist/,
    // don't clear mocks
    ...(!resetMocks ? [/^mock:/] : []),
  ]
  modules.forEach((_, path) => {
    if (skipPaths.some(re => re.test(path)))
      return
    modules.delete(path)
  })
}

export function getFullName(task: Task) {
  return getNames(task).join(c.dim(' > '))
}

export function removeUndefinedValues<T extends Record<string, any>>(obj: T): T {
  for (const key in Object.keys(obj)) {
    if (obj[key] === undefined)
      delete obj[key]
  }
  return obj
}

export async function ensurePackageInstalled(
  dependency: string,
  root: string,
) {
  if (isPackageExists(dependency, { paths: [root] }))
    return true

  const promptInstall = !process.env.CI && process.stdout.isTTY

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
    // TODO: somehow it fails to load the package after installation, remove this when it's fixed
    process.stderr.write(c.yellow(`\nPackage ${dependency} installed, re-run the command to start.\n`))
    process.exit(EXIT_CODE_RESTART)
    return true
  }

  return false
}

/**
 * If code starts with a function call, will return its last index, respecting arguments.
 * This will return 25 - last ending character of toMatch ")"
 * Also works with callbacks
 * ```
 * toMatch({ test: '123' });
 * toBeAliased('123')
 * ```
 */
export function getCallLastIndex(code: string) {
  let charIndex = -1
  let inString: string | null = null
  let startedBracers = 0
  let endedBracers = 0
  let beforeChar: string | null = null
  while (charIndex <= code.length) {
    beforeChar = code[charIndex]
    charIndex++
    const char = code[charIndex]

    const isCharString = char === '"' || char === '\'' || char === '`'

    if (isCharString && beforeChar !== '\\') {
      if (inString === char)
        inString = null
      else if (!inString)
        inString = char
    }

    if (!inString) {
      if (char === '(')
        startedBracers++
      if (char === ')')
        endedBracers++
    }

    if (startedBracers && endedBracers && startedBracers === endedBracers)
      return charIndex
  }
  return null
}

const resolve = isNode ? relativeNode : relativeBrowser

export { resolve as resolvePath }

// AggregateError is supported in Node.js 15.0.0+
class AggregateErrorPonyfill extends Error {
  errors: unknown[]
  constructor(errors: Iterable<unknown>, message = '') {
    super(message)
    this.errors = [...errors]
  }
}
export { AggregateErrorPonyfill as AggregateError }

type DeferPromise<T> = Promise<T> & {
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: any) => void
}

export function createDefer<T>(): DeferPromise<T> {
  let resolve: ((value: T | PromiseLike<T>) => void) | null = null
  let reject: ((reason?: any) => void) | null = null

  const p = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  }) as DeferPromise<T>

  p.resolve = resolve!
  p.reject = reject!
  return p
}

export function objectAttr(source: any, path: string, defaultValue = undefined) {
  // a[3].b -> a.3.b
  const paths = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let result = source
  for (const p of paths) {
    result = Object(result)[p]
    if (result === undefined)
      return defaultValue
  }
  return result
}

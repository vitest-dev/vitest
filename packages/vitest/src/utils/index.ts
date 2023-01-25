import { relative } from 'pathe'
import type { ModuleCacheMap } from 'vite-node'
import { getWorkerState } from '../utils'
import { isNode } from './env'

export * from './graph'
export * from './tasks'
export * from './base'
export * from './global'
export * from './timers'
export * from './import'
export * from './env'

export const isWindows = isNode && process.platform === 'win32'
export const getRunMode = () => getWorkerState().config.mode
export const isRunningInTest = () => getRunMode() === 'test'
export const isRunningInBenchmark = () => getRunMode() === 'benchmark'

export const relativePath = relative
export { resolve } from 'pathe'

export function resetModules(modules: ModuleCacheMap, resetMocks = false) {
  const skipPaths = [
    // Vitest
    /\/vitest\/dist\//,
    /\/vite-node\/dist\//,
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

export function removeUndefinedValues<T extends Record<string, any>>(obj: T): T {
  for (const key in Object.keys(obj)) {
    if (obj[key] === undefined)
      delete obj[key]
  }
  return obj
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

// AggregateError is supported in Node.js 15.0.0+
class AggregateErrorPonyfill extends Error {
  errors: unknown[]
  constructor(errors: Iterable<unknown>, message = '') {
    super(message)
    this.errors = [...errors]
  }
}
export { AggregateErrorPonyfill as AggregateError }

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

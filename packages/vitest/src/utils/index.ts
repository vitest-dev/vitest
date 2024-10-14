import crypto from 'node:crypto'
import { relative } from 'pathe'
import { getWorkerState } from '../utils'

export * from './graph'
export * from './tasks'
export * from './base'
export * from '../runtime/utils'
export * from './timers'
export * from './env'
export * from './modules'
export * from './serialization'
export { isWindows } from './env'

export function getRunMode() {
  return getWorkerState().config.mode
}
export function isRunningInTest() {
  return getRunMode() === 'test'
}
export function isRunningInBenchmark() {
  return getRunMode() === 'benchmark'
}

export const relativePath = relative
export { resolve } from 'pathe'

export function removeUndefinedValues<T extends Record<string, any>>(
  obj: T,
): T {
  for (const key in Object.keys(obj)) {
    if (obj[key] === undefined) {
      delete obj[key]
    }
  }
  return obj
}

/**
 * @deprecated import from `@vitest/utils` instead
 */
export function objectAttr(
  source: any,
  path: string,
  defaultValue = undefined,
) {
  // a[3].b -> a.3.b
  const paths = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let result = source
  for (const p of paths) {
    result = (new Object(result) as any)[p]
    if (result === undefined) {
      return defaultValue
    }
  }
  return result
}

export const hash = crypto.hash ?? ((
  algorithm: string,
  data: crypto.BinaryLike,
  outputEncoding: crypto.BinaryToTextEncoding,
) => crypto.createHash(algorithm).update(data).digest(outputEncoding))

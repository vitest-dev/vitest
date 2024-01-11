import { relative } from 'pathe'
import { getWorkerState } from '../utils'
import { isNode } from './env'

export * from './graph'
export * from './tasks'
export * from './base'
export * from './global'
export * from './timers'
export * from './env'
export * from './modules'
export * from './serialization'

export const isWindows = isNode && process.platform === 'win32'
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

export function removeUndefinedValues<T extends Record<string, any>>(obj: T): T {
  for (const key in Object.keys(obj)) {
    if (obj[key] === undefined)
      delete obj[key]
  }
  return obj
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

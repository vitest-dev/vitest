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
  modules.forEach((mod, path) => {
    if (skipPaths.some(re => re.test(path)))
      return
    modules.invalidateModule(mod)
  })
}

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

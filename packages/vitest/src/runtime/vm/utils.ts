import type { VMSourceTextModule, VMSyntheticModule } from './types'
import vm from 'node:vm'

// Threshold for using optimized array approach vs Set-based deduplication.
// Keep low to ensure O(n^2) array approach is actually faster than O(n) Set approach.
const SMALL_MODULE_KEY_THRESHOLD = 8

export function interopCommonJsModule(
  interopDefault: boolean | undefined,
  mod: any,
): {
  keys: string[]
  moduleExports: any
  defaultExport: any
} {
  if (isPrimitive(mod) || Array.isArray(mod) || mod instanceof Promise) {
    return {
      keys: [],
      moduleExports: {},
      defaultExport: mod,
    }
  }

  if (
    interopDefault !== false
    && '__esModule' in mod
    && !isPrimitive(mod.default)
  ) {
    const defaultKeys = Object.keys(mod.default)
    const moduleKeys = Object.keys(mod)

    let allKeys: string[]
    if (defaultKeys.length + moduleKeys.length < SMALL_MODULE_KEY_THRESHOLD) {
      // Small modules: use lightweight Set approach to avoid O(n²) while keeping overhead low
      const keySet = new Set(defaultKeys)
      for (const key of moduleKeys) {
        keySet.add(key)
      }
      allKeys = Array.from(keySet)
    }
    else {
      // Large modules: use Set for efficient deduplication
      allKeys = Array.from(new Set([...defaultKeys, ...moduleKeys]))
    }
    const filteredKeys = allKeys.filter(key => key !== 'default')

    return {
      keys: filteredKeys,
      moduleExports: new Proxy(mod, {
        get(mod, prop) {
          return mod[prop] ?? mod.default?.[prop]
        },
      }),
      defaultExport: mod,
    }
  }

  const allKeys = Object.keys(mod)
  const filteredKeys = allKeys.filter(key => key !== 'default')

  return {
    keys: filteredKeys,
    moduleExports: mod,
    defaultExport: mod,
  }
}

function isPrimitive(obj: unknown): boolean {
  const isObject = obj != null && (typeof obj === 'object' || typeof obj === 'function')
  return !isObject
}

export const SyntheticModule: typeof VMSyntheticModule = (vm as any)
  .SyntheticModule
export const SourceTextModule: typeof VMSourceTextModule = (vm as any)
  .SourceTextModule

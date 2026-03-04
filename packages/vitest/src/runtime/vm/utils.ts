import type { VMSourceTextModule, VMSyntheticModule } from './types'
import vm from 'node:vm'

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
    const defaultKets = Object.keys(mod.default)
    const moduleKeys = Object.keys(mod)
    const allKeys = new Set([...defaultKets, ...moduleKeys])
    allKeys.delete('default')
    return {
      keys: Array.from(allKeys),
      moduleExports: new Proxy(mod, {
        get(mod, prop) {
          return mod[prop] ?? mod.default?.[prop]
        },
      }),
      defaultExport: mod,
    }
  }

  return {
    keys: Object.keys(mod).filter(key => key !== 'default'),
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

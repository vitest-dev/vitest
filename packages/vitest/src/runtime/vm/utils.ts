import type { VMSourceTextModule, VMSyntheticModule } from './types'
import vm from 'node:vm'
import { isPrimitive } from 'vite-node/utils'

export function interopCommonJsModule(
  interopDefault: boolean | undefined,
  mod: any,
) {
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

export const SyntheticModule: typeof VMSyntheticModule = (vm as any)
  .SyntheticModule
export const SourceTextModule: typeof VMSourceTextModule = (vm as any)
  .SourceTextModule

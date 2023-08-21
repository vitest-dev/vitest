import vm from 'node:vm'
import { isPrimitive } from 'vite-node/utils'
import type { WorkerGlobalState } from '../../types'
import errors from './errors'
import type { VMSourceTextModule, VMSyntheticModule } from './types'

export function interopCommonJsModule(interopDefault: boolean | undefined, mod: any) {
  if (isPrimitive(mod) || Array.isArray(mod) || mod instanceof Promise) {
    return {
      keys: [],
      moduleExports: {},
      defaultExport: mod,
    }
  }

  if (interopDefault !== false && '__esModule' in mod && !isPrimitive(mod.default)) {
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

export function createStrictNodeError(message: string, code: keyof typeof errors) {
  const err = new Error(`${message
    }\n\nThis error happened because you enabled "strict" option in your "test.environmentOptions.node" configuration and have "node" environment enabled.\n`
    + 'To not see this error, fix the issue described above or disable this behavior by setting "strict" to "false".\n',
  )
  Error.captureStackTrace(err, createStrictNodeError)
  Object.assign(err, { code: errors[code] })
  return err
}

export function isStrictNode(state: WorkerGlobalState): boolean {
  return state.environment.name === 'node' && state.config.environmentOptions.node?.strict === true
}

export function moduleString(url: string, referencer?: string) {
  return `module "${url}"${referencer ? ` (imported from "${referencer}")` : ''}`
}

export function capitalize(str: string) {
  return str[0].toUpperCase() + str.slice(1)
}

export const SyntheticModule: typeof VMSyntheticModule = (vm as any).SyntheticModule
export const SourceTextModule: typeof VMSourceTextModule = (vm as any).SourceTextModule

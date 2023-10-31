import type { PluginContext } from 'rollup'
import type { Plugin } from 'vite'

let _parse: PluginContext['parse']

export function ParseStorePlugin(): Plugin {
  return {
    name: 'vitest:parse-store',
    buildStart() {
      _parse ??= this.parse
    },
  }
}

export const parseAst: PluginContext['parse'] = (...args) => _parse(...args)

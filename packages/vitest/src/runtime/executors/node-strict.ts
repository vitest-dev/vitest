import { extname, resolve } from 'pathe'
import type { ModuleCache } from 'vite-node'
import type { ResolvedConfig } from '../../types/config'
import type { ExecuteOptions } from './vitest'
import { VitestExecutor } from './vitest'

const importMetaResolveAvailable = typeof import.meta.resolve === 'function'

export class VitestNodeStrictExecutor extends VitestExecutor {
  static ESM_MODULE_API = Object.freeze([
    ['__vite_ssr_import__', 'import %s from %s', 'const %s = require(%s)'],
    ['__vite_ssr_exports__', 'export %s', 'exports.%s = %s'],
    ['__vite_ssr_exportAll__', 'export * from %s', 'module.exports = %s'],
  ])

  static CJS_MODULE_API = Object.freeze([
    ['require', 'const %s = require(%s)', 'import %s from %s'],
  ])

  static CJS_EXPORTS_API = Object.freeze([
    ['exports', 'exports.%s = %s', 'export %s'],
    ['module', 'module.exports = %s', 'export default %s'],
  ])

  static CJS_FILE_API = Object.freeze([
    '__filename',
    '__dirname',
  ])

  constructor(config: ResolvedConfig, options: ExecuteOptions) {
    super(config, options)
  }

  shouldInterop() {
    return false
  }

  prepareContext(mod: ModuleCache, context: Record<string, any>) {
    const ctx = super.prepareContext(mod, context)

    const ESM_STRICT_HINT = '\n\nIf you don\'t want to see this error, set less strict "node" environment in your configuration file.'

    Object.defineProperty(ctx.__vite_ssr_import_meta__, 'env', {
      set: (env) => {
        Object.assign(process.env, env)
      },
      get: () => {
        throw new SyntaxError(`"import.meta.env" syntax is not available in Node.js. Use "process.env" to get access to environmental variables.${ESM_STRICT_HINT}`)
      },
    })

    if (mod.format === 'cjs') {
      const ext = extname(ctx.__filename)
      // ESM syntax is allowed in .ts files (it gets compiled), but we should remove it from CJS context in .js files
      if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
        for (const [key, syntax, fix] of VitestNodeStrictExecutor.ESM_MODULE_API) {
          Object.defineProperty(ctx, key, {
            value: () => {
              throw new SyntaxError(`"${syntax}" syntax is not available in CJS context. Use "${fix}" instead.${ESM_STRICT_HINT}`)
            },
          })
        }
      }
    }
    if (mod.format === 'esm') {
      for (const [key, syntax, fix] of VitestNodeStrictExecutor.CJS_MODULE_API) {
        Object.defineProperty(ctx, key, {
          value: () => {
            throw new SyntaxError(`"${syntax}" syntax is not available in ESM context. Use "${fix}" instead.${ESM_STRICT_HINT}`)
          },
        })
      }

      for (const [key, syntax, fix] of VitestNodeStrictExecutor.CJS_EXPORTS_API) {
        Object.defineProperty(ctx, key, {
          value: new Proxy(Object.create(null), {
            get() {
              throw new SyntaxError(`"${syntax}" syntax is not available in ESM context. Use "${fix}" instead.${ESM_STRICT_HINT}`)
            },
            set() {
              throw new SyntaxError(`"${syntax}" syntax is not available in ESM context. Use "${fix}" instead.${ESM_STRICT_HINT}`)
            },
          }),
        })
      }

      for (const fileApi of VitestNodeStrictExecutor.CJS_FILE_API)
        delete ctx[fileApi]

      if (importMetaResolveAvailable) {
        Object.defineProperty(ctx.__vite_ssr_import_meta__, 'resolve', {
          writable: false,
          configurable: false,
          value: (id: string, importer?: string) => {
            return resolve(id, importer ?? ctx.__vite_ssr_import_meta__.url)
          },
        })
      }
    }

    return ctx
  }

  prepareCode(mod: ModuleCache, context: Record<string, any>, transformed: string): string {
    const code = super.prepareCode(mod, context, transformed)
    if (mod.format === 'cjs')
      return code.replace('\'use strict\';', ' '.repeat(13))
    return code
  }
}

import { ViteNodeRunner } from 'vite-node/client'
import { isInternalRequest } from 'vite-node/utils'
import type { ModuleCache, ViteNodeRunnerOptions } from 'vite-node'
import { extname, normalize } from 'pathe'
import { isNodeBuiltin } from 'mlly'
import { resolve } from 'import-meta-resolve'
import type { ResolvedConfig } from '../types'
import type { MockMap } from '../types/mocker'
import { getCurrentEnvironment, getWorkerState } from '../utils/global'
import { VitestMocker } from './mocker'
import { rpc } from './rpc'

export interface ExecuteOptions extends Pick<ViteNodeRunnerOptions, 'moduleCache'> {
  mockMap: MockMap
}

const importMetaResolveAvailable = typeof import.meta.resolve === 'function'

export async function createVitestExecutor(config: ResolvedConfig, options: Pick<ExecuteOptions, 'mockMap' | 'moduleCache'>) {
  const runner = new VitestExecutor(config, {
    moduleCache: options.moduleCache,
    mockMap: options.mockMap,
  })

  await runner.executeId('/@vite/env')

  return runner
}

export class VitestExecutor extends ViteNodeRunner {
  public mocker: VitestMocker

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

  constructor(private config: ResolvedConfig, options: ExecuteOptions) {
    super({
      fetchModule: (id) => {
        return rpc().fetch(id, this.isStrictNodeESM())
      },
      resolveId: (id, importer) => {
        return rpc().resolveId(id, importer, this.isStrictNodeESM())
      },
      moduleCache: options.moduleCache,
      interopDefault: config.deps.interopDefault,
      root: config.root,
      base: config.base,
    })

    this.mocker = new VitestMocker(this, options.mockMap)

    Object.defineProperty(globalThis, '__vitest_mocker__', {
      value: this.mocker,
      writable: true,
      configurable: true,
    })
  }

  private isStrictNodeESM() {
    const env = getCurrentEnvironment()
    return (env === 'node' && this.config.environmentOptions?.node?.strictESM) ?? false
  }

  shouldResolveId(id: string, _importee?: string | undefined): boolean {
    if (isInternalRequest(id))
      return false
    const environment = getCurrentEnvironment()
    // do not try and resolve node builtins in Node
    // import('url') returns Node internal even if 'url' package is installed
    return environment === 'node' ? !isNodeBuiltin(id) : !id.startsWith('node:')
  }

  async resolveUrl(id: string, importee?: string) {
    if (importee && importee.startsWith('mock:'))
      importee = importee.slice(5)
    return super.resolveUrl(id, importee)
  }

  async dependencyRequest(id: string, fsPath: string, callstack: string[]): Promise<any> {
    const mocked = await this.mocker.requestWithMock(fsPath, callstack)

    if (typeof mocked === 'string')
      return super.dependencyRequest(mocked, mocked, callstack)
    if (mocked && typeof mocked === 'object')
      return mocked
    return super.dependencyRequest(id, fsPath, callstack)
  }

  shouldInterop(path: string, mod: any) {
    if (this.isStrictNodeESM())
      return false
    return super.shouldInterop(path, mod)
  }

  prepareContext(mod: ModuleCache, context: Record<string, any>) {
    const workerState = getWorkerState()

    // support `import.meta.vitest` for test entry
    if (workerState.filepath && normalize(workerState.filepath) === normalize(context.__filename)) {
      // @ts-expect-error injected untyped global
      Object.defineProperty(context.__vite_ssr_import_meta__, 'vitest', { get: () => globalThis.__vitest_index__ })
    }

    if (this.isStrictNodeESM()) {
      const ESM_STRICT_HINT = '\n\nIf you don\'t want to see this error, disable "strictESM" under "environmentOptions.node" in your configuration file.'

      Object.defineProperty(context.__vite_ssr_import_meta__, 'env', {
        get: () => {
          throw new Error(`"import.meta.env" syntax is not available in Node.js. Use "process.env" to get access to environmental variables.${ESM_STRICT_HINT}`)
        },
      })

      if (mod.format === 'cjs') {
        const ext = extname(context.__filename)
        // ESM syntax is allowed in .ts files (it gets compiled), but we should remove it from CJS context in .js files
        if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
          for (const [key, syntax, fix] of VitestExecutor.ESM_MODULE_API) {
            Object.defineProperty(context, key, {
              value: () => {
                throw new Error(`"${syntax}" syntax is not available in CJS context. Use "${fix}" instead.${ESM_STRICT_HINT}`)
              },
            })
          }
        }
      }
      if (mod.format === 'esm') {
        for (const [key, syntax, fix] of VitestExecutor.CJS_MODULE_API) {
          Object.defineProperty(context, key, {
            value: () => {
              throw new Error(`"${syntax}" syntax is not available in ESM context. Use "${fix}" instead.${ESM_STRICT_HINT}`)
            },
          })
        }

        for (const [key, syntax, fix] of VitestExecutor.CJS_EXPORTS_API) {
          Object.defineProperty(context, key, {
            value: new Proxy(Object.create(null), {
              get() {
                throw new Error(`"${syntax}" syntax is not available in ESM context. Use "${fix}" instead.${ESM_STRICT_HINT}`)
              },
              set() {
                throw new Error(`"${syntax}" syntax is not available in ESM context. Use "${fix}" instead.${ESM_STRICT_HINT}`)
              },
            }),
          })
        }

        for (const fileApi of VitestExecutor.CJS_FILE_API)
          delete context[fileApi]

        if (importMetaResolveAvailable) {
          Object.defineProperty(context.__vite_ssr_import_meta__, 'resolve', {
            writable: false,
            configurable: false,
            value: (id: string, importer?: string) => {
              return resolve(id, importer ?? context.__vite_ssr_import_meta__.url)
            },
          })
        }
      }
    }

    return context
  }

  prepareCode(mod: ModuleCache, context: Record<string, any>, transformed: string): string {
    const code = super.prepareCode(mod, context, transformed)
    if (this.isStrictNodeESM()) {
      if (mod.format === 'cjs')
        return code.replace('\'use strict\';', ' '.repeat(13))
    }
    return code
  }
}

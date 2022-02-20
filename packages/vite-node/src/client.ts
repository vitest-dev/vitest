import { createRequire } from 'module'
import { fileURLToPath, pathToFileURL } from 'url'
import vm from 'vm'
import { dirname, isAbsolute, resolve } from 'pathe'
import { isNodeBuiltin } from 'mlly'
import { isPrimitive, normalizeId, slash, toFilePath } from './utils'
import type { ModuleCache, ViteNodeRunnerOptions } from './types'

export const DEFAULT_REQUEST_STUBS = {
  '/@vite/client': {
    injectQuery: (id: string) => id,
    createHotContext() {
      return {
        accept: () => {},
        prune: () => {},
      }
    },
    updateStyle() {},
  },
}

export class ViteNodeRunner {
  root: string

  moduleCache: Map<string, ModuleCache>

  constructor(public options: ViteNodeRunnerOptions) {
    this.root = options.root || process.cwd()
    this.moduleCache = options.moduleCache || new Map()
  }

  async executeFile(file: string) {
    return await this.cachedRequest(`/@fs/${slash(resolve(file))}`, [])
  }

  async executeId(id: string) {
    return await this.cachedRequest(id, [])
  }

  async cachedRequest(rawId: string, callstack: string[]) {
    const id = normalizeId(rawId, this.options.base)

    if (this.moduleCache.get(id)?.promise)
      return this.moduleCache.get(id)?.promise

    const fsPath = toFilePath(id, this.root)
    const promise = this.directRequest(id, fsPath, callstack)
    this.setCache(id, { promise })

    return await promise
  }

  async directRequest(id: string, fsPath: string, callstack: string[]) {
    callstack = [...callstack, id]
    const request = async(dep: string) => {
      // probably means it was passed as variable
      // and wasn't transformed by Vite
      if (this.shouldResolveId(dep)) {
        const resolvedDep = await this.options.resolveId(dep, id)
        dep = resolvedDep?.id || dep
      }
      if (callstack.includes(dep)) {
        if (!this.moduleCache.get(dep)?.exports)
          throw new Error(`[vite-node] Circular dependency detected\nStack:\n${[...callstack, dep].reverse().map(p => `- ${p}`).join('\n')}`)
        return this.moduleCache.get(dep)!.exports
      }
      return this.cachedRequest(dep, callstack)
    }

    const requestStubs = this.options.requestStubs || DEFAULT_REQUEST_STUBS
    if (id in requestStubs)
      return requestStubs[id]

    const { code: transformed, externalize } = await this.options.fetchModule(id)
    if (externalize) {
      const mod = await this.interopedImport(externalize)
      this.setCache(id, { exports: mod })
      return mod
    }

    if (transformed == null)
      throw new Error(`[vite-node] Failed to load ${id}`)

    // disambiguate the `<UNIT>:/` on windows: see nodejs/node#31710
    const url = pathToFileURL(fsPath).href
    const exports: any = {}

    this.setCache(id, { code: transformed, exports })

    const __filename = fileURLToPath(url)
    const moduleProxy = {
      set exports(value) {
        exportAll(exports, value)
        exports.default = value
      },
      get exports() {
        return exports.default
      },
    }

    // Be carefull when changing this
    // changing context will change amount of code added on line :114 (vm.runInThisContext)
    // this messes up sourcemaps for coverage
    // adjust `offset` variable in packages/vitest/src/integrations/coverage.ts#L100 if you do change this
    const context = this.prepareContext({
      // esm transformed by Vite
      __vite_ssr_import__: request,
      __vite_ssr_dynamic_import__: request,
      __vite_ssr_exports__: exports,
      __vite_ssr_exportAll__: (obj: any) => exportAll(exports, obj),
      __vite_ssr_import_meta__: { url },

      // cjs compact
      require: createRequire(url),
      exports,
      module: moduleProxy,
      __filename,
      __dirname: dirname(__filename),
    })

    const fn = vm.runInThisContext(`async (${Object.keys(context).join(',')})=>{{${transformed}\n}}`, {
      filename: fsPath,
      lineOffset: 0,
    })

    await fn(...Object.values(context))

    return exports
  }

  prepareContext(context: Record<string, any>) {
    return context
  }

  setCache(id: string, mod: Partial<ModuleCache>) {
    if (!this.moduleCache.has(id))
      this.moduleCache.set(id, mod)
    else
      Object.assign(this.moduleCache.get(id), mod)
  }

  shouldResolveId(dep: string) {
    if (isNodeBuiltin(dep))
      return false

    return !isAbsolute(dep)
  }

  /**
   * Define if a module should be interop-ed
   * This function mostly for the ability to override by subclass
   */
  shouldInterop(path: string, mod: any) {
    if (this.options.interopDefault === false)
      return false
    // never interop ESM modules
    // TODO: should also skip for `.js` with `type="module"`
    return !path.endsWith('.mjs') && 'default' in mod
  }

  /**
   * Import a module and interop it
   */
  async interopedImport(path: string) {
    const mod = await import(path)

    if (this.shouldInterop(path, mod)) {
      const tryDefault = this.hasNestedDefault(mod)
      return new Proxy(mod, {
        get: proxyMethod('get', tryDefault),
        set: proxyMethod('set', tryDefault),
        has: proxyMethod('has', tryDefault),
        deleteProperty: proxyMethod('deleteProperty', tryDefault),
      })
    }

    return mod
  }

  hasNestedDefault(target: any) {
    return '__esModule' in target && target.__esModule && 'default' in target.default
  }
}

function proxyMethod(name: 'get' | 'set' | 'has' | 'deleteProperty', tryDefault: boolean) {
  return function(target: any, key: string | symbol, ...args: [any?, any?]) {
    const result = Reflect[name](target, key, ...args)
    if (isPrimitive(target.default))
      return result
    if ((tryDefault && key === 'default') || typeof result === 'undefined')
      return Reflect[name](target.default, key, ...args)
    return result
  }
}

function exportAll(exports: any, sourceModule: any) {
  // eslint-disable-next-line no-restricted-syntax
  for (const key in sourceModule) {
    if (key !== 'default') {
      try {
        Object.defineProperty(exports, key, {
          enumerable: true,
          configurable: true,
          get() { return sourceModule[key] },
        })
      }
      catch (_err) { }
    }
  }
}

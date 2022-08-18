import { createRequire } from 'module'
import { fileURLToPath, pathToFileURL } from 'url'
import vm from 'vm'
import { dirname, extname, isAbsolute, resolve } from 'pathe'
import { isNodeBuiltin } from 'mlly'
import createDebug from 'debug'
import { isPrimitive, mergeSlashes, normalizeModuleId, normalizeRequestId, slash, toFilePath } from './utils'
import type { HotContext, ModuleCache, ViteNodeRunnerOptions } from './types'

const debugExecute = createDebug('vite-node:client:execute')
const debugNative = createDebug('vite-node:client:native')

export const DEFAULT_REQUEST_STUBS = {
  '/@vite/client': {
    injectQuery: (id: string) => id,
    createHotContext() {
      return {
        accept: () => {},
        prune: () => {},
        dispose: () => {},
        decline: () => {},
        invalidate: () => {},
        on: () => {},
      }
    },
    updateStyle(id: string, css: string) {
      if (typeof document === 'undefined')
        return

      const element = document.getElementById(id)
      if (element)
        element.remove()

      const head = document.querySelector('head')
      const style = document.createElement('style')
      style.setAttribute('type', 'text/css')
      style.id = id
      style.innerHTML = css
      head?.appendChild(style)
    },
  },
}

export class ModuleCacheMap extends Map<string, ModuleCache> {
  normalizePath(fsPath: string) {
    return normalizeModuleId(fsPath)
  }

  /**
   * Assign partial data to the map
   */
  update(fsPath: string, mod: Partial<ModuleCache>) {
    fsPath = this.normalizePath(fsPath)
    if (!super.has(fsPath))
      super.set(fsPath, mod)
    else
      Object.assign(super.get(fsPath) as ModuleCache, mod)
    return this
  }

  set(fsPath: string, mod: ModuleCache) {
    fsPath = this.normalizePath(fsPath)
    return super.set(fsPath, mod)
  }

  get(fsPath: string) {
    fsPath = this.normalizePath(fsPath)
    return super.get(fsPath)
  }

  delete(fsPath: string) {
    fsPath = this.normalizePath(fsPath)
    return super.delete(fsPath)
  }
}

export class ViteNodeRunner {
  root: string

  debug: boolean

  /**
   * Holds the cache of modules
   * Keys of the map are filepaths, or plain package names
   */
  moduleCache: ModuleCacheMap

  constructor(public options: ViteNodeRunnerOptions) {
    this.root = options.root ?? process.cwd()
    this.moduleCache = options.moduleCache ?? new ModuleCacheMap()
    this.debug = options.debug ?? (typeof process !== 'undefined' ? !!process.env.VITE_NODE_DEBUG_RUNNER : false)
  }

  async executeFile(file: string) {
    return await this.cachedRequest(`/@fs/${slash(resolve(file))}`, [])
  }

  async executeId(id: string) {
    return await this.cachedRequest(id, [])
  }

  /** @internal */
  async cachedRequest(rawId: string, callstack: string[]) {
    const id = normalizeRequestId(rawId, this.options.base)
    const fsPath = toFilePath(id, this.root)

    // the callstack reference itself circularly
    if (callstack.includes(fsPath) && this.moduleCache.get(fsPath)?.exports)
      return this.moduleCache.get(fsPath)?.exports

    // cached module
    if (this.moduleCache.get(fsPath)?.promise)
      return this.moduleCache.get(fsPath)?.promise

    const promise = this.directRequest(id, fsPath, callstack)
    this.moduleCache.update(fsPath, { promise })

    return await promise
  }

  /** @internal */
  async directRequest(id: string, fsPath: string, _callstack: string[]) {
    const callstack = [..._callstack, fsPath]

    const request = async (dep: string) => {
      const depFsPath = toFilePath(normalizeRequestId(dep, this.options.base), this.root)
      const getStack = () => {
        return `stack:\n${[...callstack, depFsPath].reverse().map(p => `- ${p}`).join('\n')}`
      }

      let debugTimer: any
      if (this.debug)
        debugTimer = setTimeout(() => console.warn(() => `module ${depFsPath} takes over 2s to load.\n${getStack()}`), 2000)

      try {
        if (callstack.includes(depFsPath)) {
          const depExports = this.moduleCache.get(depFsPath)?.exports
          if (depExports)
            return depExports
          throw new Error(`[vite-node] Failed to resolve circular dependency, ${getStack()}`)
        }

        const mod = await this.cachedRequest(dep, callstack)

        return mod
      }
      finally {
        if (debugTimer)
          clearTimeout(debugTimer)
      }
    }

    Object.defineProperty(request, 'callstack', { get: () => callstack })

    const resolveId = async (dep: string, callstackPosition = 1) => {
      // probably means it was passed as variable
      // and wasn't transformed by Vite
      // or some dependency name was passed
      // runner.executeFile('@scope/name')
      // runner.executeFile(myDynamicName)
      if (this.options.resolveId && this.shouldResolveId(dep)) {
        let importer = callstack[callstack.length - callstackPosition]
        if (importer && importer.startsWith('mock:'))
          importer = importer.slice(5)
        const { id } = await this.options.resolveId(dep, importer) || {}
        dep = id && isAbsolute(id) ? mergeSlashes(`/@fs/${id}`) : id || dep
      }

      return dep
    }

    id = await resolveId(id, 2)

    const requestStubs = this.options.requestStubs || DEFAULT_REQUEST_STUBS
    if (id in requestStubs)
      return requestStubs[id]

    // eslint-disable-next-line prefer-const
    let { code: transformed, externalize } = await this.options.fetchModule(id)
    if (externalize) {
      debugNative(externalize)
      const mod = await this.interopedImport(externalize)
      this.moduleCache.update(fsPath, { exports: mod })
      return mod
    }

    if (transformed == null)
      throw new Error(`[vite-node] Failed to load ${id}`)

    // disambiguate the `<UNIT>:/` on windows: see nodejs/node#31710
    const url = pathToFileURL(fsPath).href
    const meta = { url }
    const exports: any = Object.create(null)
    Object.defineProperty(exports, Symbol.toStringTag, {
      value: 'Module',
      enumerable: false,
      configurable: false,
    })

    this.moduleCache.update(fsPath, { code: transformed, exports })

    const __filename = fileURLToPath(url)
    const moduleProxy = {
      set exports(value) {
        exportAll(exports, value)
        exports.default = value
      },
      get exports() {
        return exports
      },
    }

    // Vite hot context
    let hotContext: HotContext | undefined
    if (this.options.createHotContext) {
      Object.defineProperty(meta, 'hot', {
        enumerable: true,
        get: () => {
          hotContext ||= this.options.createHotContext?.(this, `/@fs/${fsPath}`)
          return hotContext
        },
      })
    }

    // Be careful when changing this
    // changing context will change amount of code added on line :114 (vm.runInThisContext)
    // this messes up sourcemaps for coverage
    // adjust `offset` variable in packages/vitest/src/integrations/coverage/c8.ts#86 if you do change this
    const context = this.prepareContext({
      // esm transformed by Vite
      __vite_ssr_import__: request,
      __vite_ssr_dynamic_import__: request,
      __vite_ssr_exports__: exports,
      __vite_ssr_exportAll__: (obj: any) => exportAll(exports, obj),
      __vite_ssr_import_meta__: meta,
      __vitest_resolve_id__: resolveId,

      // cjs compact
      require: createRequire(url),
      exports,
      module: moduleProxy,
      __filename,
      __dirname: dirname(__filename),
    })

    debugExecute(__filename)

    // remove shebang
    if (transformed[0] === '#')
      transformed = transformed.replace(/^\#\!.*/, s => ' '.repeat(s.length))

    // add 'use strict' since ESM enables it by default
    const fn = vm.runInThisContext(`'use strict';async (${Object.keys(context).join(',')})=>{{${transformed}\n}}`, {
      filename: fsPath,
      lineOffset: 0,
    })

    await fn(...Object.values(context))

    return exports
  }

  prepareContext(context: Record<string, any>) {
    return context
  }

  shouldResolveId(dep: string) {
    if (isNodeBuiltin(dep) || dep in (this.options.requestStubs || DEFAULT_REQUEST_STUBS) || dep.startsWith('/@vite'))
      return false

    return !isAbsolute(dep) || !extname(dep)
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
  return function (target: any, key: string | symbol, ...args: [any?, any?]) {
    const result = Reflect[name](target, key, ...args)
    if (isPrimitive(target.default))
      return result
    if ((tryDefault && key === 'default') || typeof result === 'undefined')
      return Reflect[name](target.default, key, ...args)
    return result
  }
}

function exportAll(exports: any, sourceModule: any) {
  // #1120 when a module exports itself it causes
  // call stack error
  if (exports === sourceModule)
    return

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

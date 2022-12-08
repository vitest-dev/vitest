import { createRequire } from 'module'
// we need native dirname, because windows __dirname has \\
// eslint-disable-next-line no-restricted-imports
import { dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import vm from 'vm'
import { extname, isAbsolute, resolve } from 'pathe'
import { isNodeBuiltin } from 'mlly'
import createDebug from 'debug'
import { cleanUrl, isInternalRequest, isPrimitive, normalizeModuleId, normalizeRequestId, slash, toFilePath } from './utils'
import type { HotContext, ModuleCache, ViteNodeRunnerOptions } from './types'
import { extractSourceMap } from './source-map'

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

  get(fsPath: string): ModuleCache {
    fsPath = this.normalizePath(fsPath)
    if (!super.has(fsPath))
      super.set(fsPath, {})
    return super.get(fsPath)!
  }

  delete(fsPath: string) {
    fsPath = this.normalizePath(fsPath)
    return super.delete(fsPath)
  }

  /**
   * Invalidate modules that dependent on the given modules, up to the main entry
   */
  invalidateDepTree(ids: string[] | Set<string>, invalidated = new Set<string>()) {
    for (const _id of ids) {
      const id = this.normalizePath(_id)
      if (invalidated.has(id))
        continue
      invalidated.add(id)
      const mod = super.get(id)
      if (mod?.importers)
        this.invalidateDepTree(mod.importers, invalidated)
      super.delete(id)
    }
    return invalidated
  }

  /**
   * Invalidate dependency modules of the given modules, down to the bottom-level dependencies
   */
  invalidateSubDepTree(ids: string[] | Set<string>, invalidated = new Set<string>()) {
    for (const _id of ids) {
      const id = this.normalizePath(_id)
      if (invalidated.has(id))
        continue
      invalidated.add(id)
      const subIds = Array.from(super.entries())
        .filter(([,mod]) => mod.importers?.has(id))
        .map(([key]) => key)
      subIds.length && this.invalidateSubDepTree(subIds, invalidated)
      super.delete(id)
    }
    return invalidated
  }

  /**
   * Return parsed source map based on inlined source map of the module
   */
  getSourceMap(id: string) {
    const cache = this.get(id)
    if (cache.map)
      return cache.map
    const map = cache.code && extractSourceMap(cache.code)
    if (map) {
      cache.map = map
      return map
    }
    return null
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
    const id = slash(resolve(file))
    const url = `/@fs/${slash(resolve(file))}`
    return await this.cachedRequest(id, url, [])
  }

  async executeId(id: string) {
    const url = await this.resolveUrl(id)
    return await this.cachedRequest(id, url, [])
  }

  getSourceMap(id: string) {
    return this.moduleCache.getSourceMap(id)
  }

  /** @internal */
  async cachedRequest(rawId: string, url: string, callstack: string[]) {
    const importee = callstack[callstack.length - 1]

    const mod = this.moduleCache.get(url)

    if (!mod.importers)
      mod.importers = new Set()
    if (importee)
      mod.importers.add(importee)

    // the callstack reference itself circularly
    if (callstack.includes(url) && mod.exports)
      return mod.exports

    // cached module
    if (mod.promise)
      return mod.promise

    const promise = this.directRequest(rawId, url, callstack)
    Object.assign(mod, { promise, evaluated: false })

    try {
      return await promise
    }
    finally {
      mod.evaluated = true
    }
  }

  async resolveUrl(url: string, importee?: string): Promise<string> {
    if (isInternalRequest(url))
      return url
    url = normalizeRequestId(url, this.options.base)
    if (!this.options.resolveId)
      return toFilePath(url, this.root)
    if (importee && url[0] !== '.')
      importee = undefined
    const resolved = await this.options.resolveId(url, importee)
    const resolvedId = resolved?.id || url
    return normalizeRequestId(resolvedId, this.options.base)
  }

  /** @internal */
  async dependencyRequest(id: string, url: string, callstack: string[]) {
    const getStack = () => {
      return `stack:\n${[...callstack, url].reverse().map(p => `- ${p}`).join('\n')}`
    }

    let debugTimer: any
    if (this.debug)
      debugTimer = setTimeout(() => console.warn(() => `module ${url} takes over 2s to load.\n${getStack()}`), 2000)

    try {
      if (callstack.includes(url)) {
        const depExports = this.moduleCache.get(url)?.exports
        if (depExports)
          return depExports
        throw new Error(`[vite-node] Failed to resolve circular dependency, ${getStack()}`)
      }

      return await this.cachedRequest(id, url, callstack)
    }
    finally {
      if (debugTimer)
        clearTimeout(debugTimer)
    }
  }

  /** @internal */
  async directRequest(id: string, url: string, _callstack: string[]) {
    const moduleId = normalizeModuleId(url)
    const callstack = [..._callstack, moduleId]

    const mod = this.moduleCache.get(url)

    const request = async (dep: string) => {
      const depFsPath = await this.resolveUrl(dep, url)
      return this.dependencyRequest(dep, depFsPath, callstack)
    }

    const requestStubs = this.options.requestStubs || DEFAULT_REQUEST_STUBS
    if (id in requestStubs)
      return requestStubs[id]

    // eslint-disable-next-line prefer-const
    let { code: transformed, externalize } = await this.options.fetchModule(url)

    if (externalize) {
      debugNative(externalize)
      const exports = await this.interopedImport(externalize)
      mod.exports = exports
      return exports
    }

    if (transformed == null)
      throw new Error(`[vite-node] Failed to load "${id}" imported from ${callstack[callstack.length - 2]}`)

    const modulePath = cleanUrl(moduleId)
    // disambiguate the `<UNIT>:/` on windows: see nodejs/node#31710
    const href = pathToFileURL(modulePath).href
    const meta = { url: href }
    const exports = Object.create(null)
    Object.defineProperty(exports, Symbol.toStringTag, {
      value: 'Module',
      enumerable: false,
      configurable: false,
    })
    // this prosxy is triggered only on exports.name and module.exports access
    const cjsExports = new Proxy(exports, {
      set(_, p, value) {
        if (!Reflect.has(exports, 'default'))
          exports.default = {}

        // returns undefined, when accessing named exports, if default is not an object
        // but is still present inside hasOwnKeys, this is Node behaviour for CJS
        if (isPrimitive(exports.default)) {
          defineExport(exports, p, () => undefined)
          return true
        }

        exports.default[p] = value
        if (p !== 'default')
          defineExport(exports, p, () => value)

        return true
      },
    })

    Object.assign(mod, { code: transformed, exports })
    const __filename = fileURLToPath(href)
    const moduleProxy = {
      set exports(value) {
        exportAll(cjsExports, value)
        exports.default = value
      },
      get exports() {
        return cjsExports
      },
    }

    // Vite hot context
    let hotContext: HotContext | undefined
    if (this.options.createHotContext) {
      Object.defineProperty(meta, 'hot', {
        enumerable: true,
        get: () => {
          hotContext ||= this.options.createHotContext?.(this, `/@fs/${url}`)
          return hotContext
        },
      })
    }

    // Be careful when changing this
    // changing context will change amount of code added on line :114 (vm.runInThisContext)
    // this messes up sourcemaps for coverage
    // adjust `offset` variable in packages/coverage-c8/src/provider.ts#86 if you do change this
    const context = this.prepareContext({
      // esm transformed by Vite
      __vite_ssr_import__: request,
      __vite_ssr_dynamic_import__: request,
      __vite_ssr_exports__: exports,
      __vite_ssr_exportAll__: (obj: any) => exportAll(exports, obj),
      __vite_ssr_import_meta__: meta,

      // cjs compact
      require: createRequire(href),
      exports: cjsExports,
      module: moduleProxy,
      __filename,
      __dirname: dirname(__filename),
    })

    debugExecute(__filename)

    // remove shebang
    if (transformed[0] === '#')
      transformed = transformed.replace(/^\#\!.*/, s => ' '.repeat(s.length))

    // add 'use strict' since ESM enables it by default
    const codeDefinition = `'use strict';async (${Object.keys(context).join(',')})=>{{`
    const code = `${codeDefinition}${transformed}\n}}`
    const fn = vm.runInThisContext(code, {
      filename: __filename,
      lineOffset: 0,
      columnOffset: -codeDefinition.length,
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
  return function (target: any, key: string | symbol, ...args: [any?, any?]): any {
    const result = Reflect[name](target, key, ...args)
    if (isPrimitive(target.default))
      return result
    if ((tryDefault && key === 'default') || typeof result === 'undefined')
      return Reflect[name](target.default, key, ...args)
    return result
  }
}

// keep consistency with Vite on how exports are defined
function defineExport(exports: any, key: string | symbol, value: () => any) {
  Object.defineProperty(exports, key, {
    enumerable: true,
    configurable: true,
    get: value,
  })
}

function exportAll(exports: any, sourceModule: any) {
  // #1120 when a module exports itself it causes
  // call stack error
  if (exports === sourceModule)
    return

  if (isPrimitive(sourceModule) || Array.isArray(sourceModule))
    return

  for (const key in sourceModule) {
    if (key !== 'default') {
      try {
        defineExport(exports, key, () => sourceModule[key])
      }
      catch (_err) { }
    }
  }
}

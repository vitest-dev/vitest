import type { FileMap } from './file-map'
import type { ImportModuleDynamically, VMModule } from './types'
import { Module as _Module, createRequire } from 'node:module'
import vm from 'node:vm'
import { basename, dirname, extname } from 'pathe'
import { isNodeBuiltin } from 'vite-node/utils'

interface CommonjsExecutorOptions {
  fileMap: FileMap
  context: vm.Context
  importModuleDynamically: ImportModuleDynamically
}

const _require = createRequire(import.meta.url)

interface PrivateNodeModule extends NodeModule {
  _compile: (code: string, filename: string) => void
}

const requiresCache = new WeakMap<NodeModule, NodeRequire>()

export class CommonjsExecutor {
  private context: vm.Context
  private requireCache = new Map<string, NodeModule>()
  private publicRequireCache = this.createProxyCache()

  private moduleCache = new Map<string, VMModule | Promise<VMModule>>()
  private builtinCache: Record<string, NodeModule> = Object.create(null)
  private extensions: Record<
    string,
    (m: NodeModule, filename: string) => unknown
  > = Object.create(null)

  private fs: FileMap
  private Module: typeof _Module

  constructor(options: CommonjsExecutorOptions) {
    this.context = options.context
    this.fs = options.fileMap

    const primitives = vm.runInContext(
      '({ Object, Array, Error })',
      this.context,
    ) as {
      Object: typeof Object
      Array: typeof Array
      Error: typeof Error
    }

    // eslint-disable-next-line ts/no-this-alias
    const executor = this

    this.Module = class Module {
      exports: any
      isPreloading = false
      id: string
      filename: string
      loaded: boolean
      parent: null | Module | undefined
      children: Module[] = []
      path: string
      paths: string[] = []

      constructor(id = '', parent?: Module) {
        this.exports = primitives.Object.create(Object.prototype)
        // in our case the path should always be resolved already
        this.path = dirname(id)
        this.id = id
        this.filename = id
        this.loaded = false
        this.parent = parent
      }

      get require() {
        const require = requiresCache.get(this)
        if (require) {
          return require
        }

        const _require = Module.createRequire(this.id)
        requiresCache.set(this, _require)
        return _require
      }

      static register = () => {
        throw new Error(
          `[vitest] "register" is not available when running in Vitest.`,
        )
      }

      _compile(code: string, filename: string) {
        const cjsModule = Module.wrap(code)
        const script = new vm.Script(cjsModule, {
          filename,
          importModuleDynamically: options.importModuleDynamically,
        } as any)
        // @ts-expect-error mark script with current identifier
        script.identifier = filename
        const fn = script.runInContext(executor.context)
        const __dirname = dirname(filename)
        executor.requireCache.set(filename, this)
        try {
          fn(this.exports, this.require, this, filename, __dirname)
          return this.exports
        }
        finally {
          this.loaded = true
        }
      }

      // exposed for external use, Node.js does the opposite
      static _load = (
        request: string,
        parent: Module | undefined,
        _isMain: boolean,
      ) => {
        const require = Module.createRequire(parent?.filename ?? request)
        return require(request)
      }

      static wrap = (script: string) => {
        return Module.wrapper[0] + script + Module.wrapper[1]
      }

      static wrapper = new primitives.Array(
        '(function (exports, require, module, __filename, __dirname) { ',
        '\n});',
      )

      static builtinModules = _Module.builtinModules
      static findSourceMap = _Module.findSourceMap
      static SourceMap = _Module.SourceMap
      static syncBuiltinESMExports = _Module.syncBuiltinESMExports

      static _cache = executor.moduleCache
      static _extensions = executor.extensions

      static createRequire = (filename: string) => {
        return executor.createRequire(filename)
      }

      static runMain = () => {
        throw new primitives.Error('[vitest] "runMain" is not implemented.')
      }

      // @ts-expect-error not typed
      static _resolveFilename = _Module._resolveFilename
      // @ts-expect-error not typed
      static _findPath = _Module._findPath
      // @ts-expect-error not typed
      static _initPaths = _Module._initPaths
      // @ts-expect-error not typed
      static _preloadModules = _Module._preloadModules
      // @ts-expect-error not typed
      static _resolveLookupPaths = _Module._resolveLookupPaths
      // @ts-expect-error not typed
      static globalPaths = _Module.globalPaths
      static isBuiltin = _Module.isBuiltin

      static constants = _Module.constants
      static enableCompileCache = _Module.enableCompileCache
      static getCompileCacheDir = _Module.getCompileCacheDir
      static flushCompileCache = _Module.flushCompileCache

      static Module = Module
    }

    this.extensions['.js'] = this.requireJs
    this.extensions['.json'] = this.requireJson
  }

  private requireJs = (m: NodeModule, filename: string) => {
    const content = this.fs.readFile(filename);
    (m as PrivateNodeModule)._compile(content, filename)
  }

  private requireJson = (m: NodeModule, filename: string) => {
    const code = this.fs.readFile(filename)
    m.exports = JSON.parse(code)
  }

  public createRequire = (filename: string) => {
    const _require = createRequire(filename)
    const require = ((id: string) => {
      const resolved = _require.resolve(id)
      return this.require(resolved)
    }) as NodeRequire
    require.resolve = _require.resolve
    Object.defineProperty(require, 'extensions', {
      get: () => this.extensions,
      set: () => {},
      configurable: true,
    })
    require.main = undefined // there is no main, since we are running tests using ESM
    require.cache = this.publicRequireCache
    return require
  }

  private createProxyCache() {
    return new Proxy(Object.create(null), {
      defineProperty: () => true,
      deleteProperty: () => true,
      set: () => true,
      get: (_, key: string) => this.requireCache.get(key),
      has: (_, key: string) => this.requireCache.has(key),
      ownKeys: () => Array.from(this.requireCache.keys()),
      getOwnPropertyDescriptor() {
        return {
          configurable: true,
          enumerable: true,
        }
      },
    })
  }

  // very naive implementation for Node.js require
  private loadCommonJSModule(
    module: NodeModule,
    filename: string,
  ): Record<string, unknown> {
    const cached = this.requireCache.get(filename)
    if (cached) {
      return cached.exports
    }

    const extension = this.findLongestRegisteredExtension(filename)
    const loader = this.extensions[extension] || this.extensions['.js']
    loader(module, filename)

    return module.exports
  }

  private findLongestRegisteredExtension(filename: string) {
    const name = basename(filename)
    let currentExtension: string
    let index: number
    let startIndex = 0
    // eslint-disable-next-line no-cond-assign
    while ((index = name.indexOf('.', startIndex)) !== -1) {
      startIndex = index + 1
      if (index === 0) {
        continue
      } // Skip dotfiles like .gitignore
      currentExtension = name.slice(index)
      if (this.extensions[currentExtension]) {
        return currentExtension
      }
    }
    return '.js'
  }

  public require(identifier: string) {
    const ext = extname(identifier)
    if (ext === '.node' || isNodeBuiltin(identifier)) {
      return this.requireCoreModule(identifier)
    }
    const module = new this.Module(identifier)
    return this.loadCommonJSModule(module, identifier)
  }

  private requireCoreModule(identifier: string) {
    const normalized = identifier.replace(/^node:/, '')
    if (this.builtinCache[normalized]) {
      return this.builtinCache[normalized].exports
    }
    const moduleExports = _require(identifier)
    if (identifier === 'node:module' || identifier === 'module') {
      const module = new this.Module('/module.js') // path should not matter
      module.exports = this.Module
      this.builtinCache[normalized] = module
      return module.exports
    }
    this.builtinCache[normalized] = _require.cache[normalized]!
    // TODO: should we wrap module to rethrow context errors?
    return moduleExports
  }
}

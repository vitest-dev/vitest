import type { FileMap } from './file-map'
import type { ImportModuleDynamically, VMSyntheticModule } from './types'
import { Module as _Module, createRequire, isBuiltin } from 'node:module'
import vm from 'node:vm'
import { basename, dirname, extname } from 'pathe'
import { interopCommonJsModule, SyntheticModule } from './utils'

interface CommonjsExecutorOptions {
  fileMap: FileMap
  interopDefault?: boolean
  context: vm.Context
  importModuleDynamically: ImportModuleDynamically
}

const _require = createRequire(import.meta.url)

interface PrivateNodeModule extends NodeJS.Module {
  _compile: (code: string, filename: string) => void
}

const requiresCache = new WeakMap<NodeJS.Module, NodeJS.Require>()

export class CommonjsExecutor {
  private context: vm.Context
  private requireCache = new Map<string, NodeJS.Module>()
  private publicRequireCache = this.createProxyCache()

  private moduleCache = new Map<string, VMSyntheticModule>()
  private builtinCache: Record<string, NodeJS.Module> = Object.create(null)
  private extensions: Record<
    string,
    (m: NodeJS.Module, filename: string) => unknown
  > = Object.create(null)

  private fs: FileMap
  private Module: typeof _Module
  private interopDefault: boolean | undefined

  constructor(options: CommonjsExecutorOptions) {
    this.context = options.context
    this.fs = options.fileMap
    this.interopDefault = options.interopDefault

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

      static getSourceMapsSupport = () => ({
        enabled: false,
        nodeModules: false,
        generatedCode: false,
      })

      static setSourceMapsSupport = () => {
        // noop
      }

      static register = () => {
        throw new Error(
          `[vitest] "register" is not available when running in Vitest.`,
        )
      }

      static registerHooks = () => {
        throw new Error(
          `[vitest] "registerHooks" is not available when running in Vitest.`,
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

      static _cache = executor.publicRequireCache
      static _extensions = executor.extensions

      static createRequire = (filename: string | URL) => {
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
      static stripTypeScriptTypes = _Module.stripTypeScriptTypes
      static findPackageJSON = _Module.findPackageJSON

      static Module = Module
    }

    this.extensions['.js'] = this.requireJs
    this.extensions['.json'] = this.requireJson
  }

  private requireJs = (m: NodeJS.Module, filename: string) => {
    const content = this.fs.readFile(filename);
    (m as PrivateNodeModule)._compile(content, filename)
  }

  private requireJson = (m: NodeJS.Module, filename: string) => {
    const code = this.fs.readFile(filename)
    m.exports = JSON.parse(code)
  }

  private static cjsConditions: Set<string> | undefined
  private static getCjsConditions(): Set<string> {
    if (!CommonjsExecutor.cjsConditions) {
      CommonjsExecutor.cjsConditions = parseCjsConditions(
        process.execArgv,
        process.env.NODE_OPTIONS,
      )
    }
    return CommonjsExecutor.cjsConditions
  }

  public createRequire = (filename: string | URL): NodeJS.Require => {
    const _require = createRequire(filename)
    const resolve = (id: string, options?: { paths?: string[] }) => {
      return _require.resolve(id, {
        ...options,
        // Works on Node 22.12+ where _resolveFilename supports conditions.
        // Silently ignored on older Node versions.
        conditions: CommonjsExecutor.getCjsConditions(),
      } as any)
    }
    const require = ((id: string) => {
      const resolved = resolve(id)
      const ext = extname(resolved)
      if (ext === '.node' || isBuiltin(resolved)) {
        return this.requireCoreModule(resolved)
      }
      const module = new this.Module(resolved)
      return this.loadCommonJSModule(module, resolved)
    }) as NodeJS.Require
    require.resolve = resolve as NodeJS.RequireResolve
    require.resolve.paths = _require.resolve.paths
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
    module: NodeJS.Module,
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

  public getCoreSyntheticModule(identifier: string): VMSyntheticModule {
    if (this.moduleCache.has(identifier)) {
      return this.moduleCache.get(identifier)!
    }
    const exports = this.require(identifier)
    const keys = Object.keys(exports)
    const module = new SyntheticModule([...keys, 'default'], () => {
      for (const key of keys) {
        module.setExport(key, exports[key])
      }
      module.setExport('default', exports)
    }, { context: this.context, identifier })
    this.moduleCache.set(identifier, module)
    return module
  }

  public getCjsSyntheticModule(path: string, identifier: string): VMSyntheticModule {
    if (this.moduleCache.has(identifier)) {
      return this.moduleCache.get(identifier)!
    }
    const exports = this.require(path)
    // TODO: technically module should be parsed to find static exports, implement for strict mode in #2854
    const { keys, moduleExports, defaultExport } = interopCommonJsModule(
      this.interopDefault,
      exports,
    )
    const module = new SyntheticModule([...keys, 'default'], function () {
      for (const key of keys) {
        this.setExport(key, moduleExports[key])
      }
      this.setExport('default', defaultExport)
    }, { context: this.context, identifier })
    this.moduleCache.set(identifier, module)
    return module
  }

  // TODO: use this in strict mode, when available in #2854
  // private _getNamedCjsExports(path: string): Set<string> {
  //   const cachedNamedExports = this.cjsNamedExportsMap.get(path)

  //   if (cachedNamedExports) {
  //     return cachedNamedExports
  //   }

  //   if (extname(path) === '.node') {
  //     const moduleExports = this.require(path)
  //     const namedExports = new Set(Object.keys(moduleExports))
  //     this.cjsNamedExportsMap.set(path, namedExports)
  //     return namedExports
  //   }

  //   const code = this.fs.readFile(path)
  //   const { exports, reexports } = parseCjs(code, path)
  //   const namedExports = new Set(exports)
  //   this.cjsNamedExportsMap.set(path, namedExports)

  //   for (const reexport of reexports) {
  //     if (isNodeBuiltin(reexport)) {
  //       const exports = this.require(reexport)
  //       if (exports !== null && typeof exports === 'object') {
  //         for (const e of Object.keys(exports)) {
  //           namedExports.add(e)
  //         }
  //       }
  //     }
  //     else {
  //       const require = this.createRequire(path)
  //       const resolved = require.resolve(reexport)

  //       const exports = this._getNamedCjsExports(resolved)

  //       for (const e of exports) {
  //         namedExports.add(e)
  //       }
  //     }
  //   }

  //   return namedExports
  // }

  public require(identifier: string): any {
    const ext = extname(identifier)
    if (ext === '.node' || isBuiltin(identifier)) {
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

// The "module-sync" exports condition (added in Node 22.12/20.19 when
// require(esm) was unflagged) can resolve to ESM files that our CJS
// vm.Script executor cannot handle. We exclude it by passing explicit
// CJS conditions to require.resolve (Node 22.12+).
// Must be a Set because Node's internal resolver calls conditions.has().
// User-specified --conditions/-C flags are respected, except module-sync.
export function parseCjsConditions(
  execArgv: string[],
  nodeOptions?: string,
): Set<string> {
  const conditions = ['node', 'require', 'node-addons']
  const args = [
    ...execArgv,
    ...(nodeOptions?.split(/\s+/) ?? []),
  ]
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const eqMatch = arg.match(/^(?:--conditions|-C)=(.+)$/)
    if (eqMatch) {
      conditions.push(eqMatch[1])
    }
    else if ((arg === '--conditions' || arg === '-C') && i + 1 < args.length) {
      conditions.push(args[++i])
    }
  }
  return new Set(conditions.filter(c => c !== 'module-sync'))
}

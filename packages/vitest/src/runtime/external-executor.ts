/* eslint-disable antfu/no-cjs-exports */

import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname } from 'node:path'
import { Module as _Module, createRequire } from 'node:module'
import { readFileSync, statSync } from 'node:fs'
import { basename, extname, join, normalize } from 'pathe'
import { getCachedData, isNodeBuiltin, isPrimitive, setCacheData } from 'vite-node/utils'
import { CSS_LANGS_RE, KNOWN_ASSET_RE } from 'vite-node/constants'
import { getColors } from '@vitest/utils'
import type { ExecuteOptions } from './execute'

// need to copy paste types for vm
// because they require latest @types/node which we don't bundle

interface ModuleEvaluateOptions {
  timeout?: vm.RunningScriptOptions['timeout'] | undefined
  breakOnSigint?: vm.RunningScriptOptions['breakOnSigint'] | undefined
}

type ModuleLinker = (specifier: string, referencingModule: VMModule, extra: { assert: Object }) => VMModule | Promise<VMModule>
type ModuleStatus = 'unlinked' | 'linking' | 'linked' | 'evaluating' | 'evaluated' | 'errored'
declare class VMModule {
  dependencySpecifiers: readonly string[]
  error: any
  identifier: string
  context: vm.Context
  namespace: Object
  status: ModuleStatus
  evaluate(options?: ModuleEvaluateOptions): Promise<void>
  link(linker: ModuleLinker): Promise<void>
}
interface SyntheticModuleOptions {
  /**
   * String used in stack traces.
   * @default 'vm:module(i)' where i is a context-specific ascending index.
   */
  identifier?: string | undefined
  /**
   * The contextified object as returned by the `vm.createContext()` method, to compile and evaluate this module in.
   */
  context?: vm.Context | undefined
}
declare class VMSyntheticModule extends VMModule {
  /**
   * Creates a new `SyntheticModule` instance.
   * @param exportNames Array of names that will be exported from the module.
   * @param evaluateCallback Called when the module is evaluated.
   */
  constructor(exportNames: string[], evaluateCallback: (this: VMSyntheticModule) => void, options?: SyntheticModuleOptions)
  /**
   * This method is used after the module is linked to set the values of exports.
   * If it is called before the module is linked, an `ERR_VM_MODULE_STATUS` error will be thrown.
   * @param name
   * @param value
   */
  setExport(name: string, value: any): void
}

declare interface ImportModuleDynamically {
  (specifier: string, script: VMModule, importAssertions: Object): VMModule | Promise<VMModule>
}

interface SourceTextModuleOptions {
  identifier?: string | undefined
  cachedData?: vm.ScriptOptions['cachedData'] | undefined
  context?: vm.Context | undefined
  lineOffset?: vm.BaseOptions['lineOffset'] | undefined
  columnOffset?: vm.BaseOptions['columnOffset'] | undefined
  /**
   * Called during evaluation of this module to initialize the `import.meta`.
   */
  initializeImportMeta?: ((meta: ImportMeta, module: VMSourceTextModule) => void) | undefined
  importModuleDynamically?: ImportModuleDynamically
}
declare class VMSourceTextModule extends VMModule {
  /**
   * Creates a new `SourceTextModule` instance.
   * @param code JavaScript Module code to parse
   */
  constructor(code: string, options?: SourceTextModuleOptions)
}

const SyntheticModule: typeof VMSyntheticModule = (vm as any).SyntheticModule
const SourceTextModule: typeof VMSourceTextModule = (vm as any).SourceTextModule

interface PrivateNodeModule extends NodeModule {
  _compile(code: string, filename: string): void
}

const _require = createRequire(import.meta.url)

const nativeResolve = import.meta.resolve!

const dataURIRegex
  = /^data:(?<mime>text\/javascript|application\/json|application\/wasm)(?:;(?<encoding>charset=utf-8|base64))?,(?<code>.*)$/

export interface ExternalModulesExecutorOptions extends ExecuteOptions {
  context: vm.Context
  packageCache: Map<string, any>
}

// TODO: improve Node.js strict mode support in #2854
export class ExternalModulesExecutor {
  private requireCache: Record<string, NodeModule> = Object.create(null)
  private builtinCache: Record<string, NodeModule> = Object.create(null)
  private moduleCache = new Map<string, VMModule | Promise<VMModule>>()
  private extensions: Record<string, (m: NodeModule, filename: string) => unknown> = Object.create(null)

  private esmLinkMap = new WeakMap<VMModule, Promise<void>>()
  private context: vm.Context

  private fsCache = new Map<string, string>()
  private fsBufferCache = new Map<string, Buffer>()

  private Module: typeof _Module
  private primitives: {
    Object: typeof Object
    Array: typeof Array
    Error: typeof Error
  }

  constructor(private options: ExternalModulesExecutorOptions) {
    this.context = options.context

    const primitives = vm.runInContext('({ Object, Array, Error })', this.context) as {
      Object: typeof Object
      Array: typeof Array
      Error: typeof Error
    }
    this.primitives = primitives

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const executor = this

    // primitive implementation, some fields are not filled yet, like "paths" - #2854
    this.Module = class Module {
      exports: any
      isPreloading = false
      require: NodeRequire
      id: string
      filename: string
      loaded: boolean
      parent: null | Module | undefined
      children: Module[] = []
      path: string
      paths: string[] = []

      constructor(id: string, parent?: Module) {
        this.exports = primitives.Object.create(Object.prototype)
        this.require = Module.createRequire(id)
        // in our case the path should always be resolved already
        this.path = dirname(id)
        this.id = id
        this.filename = id
        this.loaded = false
        this.parent = parent
      }

      _compile(code: string, filename: string) {
        const cjsModule = Module.wrap(code)
        const script = new vm.Script(cjsModule, {
          filename,
          importModuleDynamically: executor.importModuleDynamically,
        } as any)
        // @ts-expect-error mark script with current identifier
        script.identifier = filename
        const fn = script.runInContext(executor.context)
        const __dirname = dirname(filename)
        executor.requireCache[filename] = this
        try {
          fn(this.exports, this.require, this, filename, __dirname)
          return this.exports
        }
        finally {
          this.loaded = true
        }
      }

      // exposed for external use, Node.js does the opposite
      static _load = (request: string, parent: Module | undefined, _isMain: boolean) => {
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
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore not typed in lower versions
      static isBuiltin = _Module.isBuiltin

      static Module = Module
    }

    this.extensions['.js'] = this.requireJs
    this.extensions['.json'] = this.requireJson
  }

  private requireJs = (m: NodeModule, filename: string) => {
    const content = this.readFile(filename)
    ;(m as PrivateNodeModule)._compile(content, filename)
  }

  private requireJson = (m: NodeModule, filename: string) => {
    const code = this.readFile(filename)
    m.exports = JSON.parse(code)
  }

  public importModuleDynamically = async (specifier: string, referencer: VMModule) => {
    const module = await this.resolveModule(specifier, referencer.identifier)
    return this.evaluateModule(module)
  }

  private resolveModule = async (specifier: string, referencer: string) => {
    const identifier = await this.resolveAsync(specifier, referencer)
    return await this.createModule(identifier)
  }

  private async resolveAsync(specifier: string, parent: string) {
    return nativeResolve(specifier, parent)
  }

  private readFile(path: string) {
    const cached = this.fsCache.get(path)
    if (cached)
      return cached
    const source = readFileSync(path, 'utf-8')
    this.fsCache.set(path, source)
    return source
  }

  private readBuffer(path: string) {
    const cached = this.fsBufferCache.get(path)
    if (cached)
      return cached
    const buffer = readFileSync(path)
    this.fsBufferCache.set(path, buffer)
    return buffer
  }

  private findNearestPackageData(basedir: string): { type?: 'module' | 'commonjs' } {
    const originalBasedir = basedir
    const packageCache = this.options.packageCache
    while (basedir) {
      const cached = getCachedData(packageCache, basedir, originalBasedir)
      if (cached)
        return cached

      const pkgPath = join(basedir, 'package.json')
      try {
        if (statSync(pkgPath, { throwIfNoEntry: false })?.isFile()) {
          const pkgData = JSON.parse(this.readFile(pkgPath))

          if (packageCache)
            setCacheData(packageCache, pkgData, basedir, originalBasedir)

          return pkgData
        }
      }
      catch {}

      const nextBasedir = dirname(basedir)
      if (nextBasedir === basedir)
        break
      basedir = nextBasedir
    }

    return {}
  }

  private wrapCoreSynteticModule(identifier: string, exports: Record<string, unknown>) {
    const moduleKeys = Object.keys(exports)
    const m: any = new SyntheticModule(
      [...moduleKeys, 'default'],
      () => {
        for (const key of moduleKeys)
          m.setExport(key, exports[key])
        m.setExport('default', exports)
      },
      {
        context: this.context,
        identifier,
      },
    )
    return m
  }

  private interopCommonJsModule(mod: any) {
    if (isPrimitive(mod) || Array.isArray(mod) || mod instanceof Promise) {
      return {
        keys: [],
        moduleExports: {},
        defaultExport: mod,
      }
    }

    if (this.options.interopDefault !== false && '__esModule' in mod && !isPrimitive(mod.default)) {
      return {
        keys: Array.from(new Set(Object.keys(mod.default).concat(Object.keys(mod)).filter(key => key !== 'default'))),
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

  private wrapCommonJsSynteticModule(identifier: string, exports: Record<string, unknown>) {
    // TODO: technically module should be parsed to find static exports, implement for strict mode in #2854
    const { keys, moduleExports, defaultExport } = this.interopCommonJsModule(exports)
    const m: any = new SyntheticModule(
      [...keys, 'default'],
      () => {
        for (const key of keys)
          m.setExport(key, moduleExports[key])
        m.setExport('default', defaultExport)
      },
      {
        context: this.context,
        identifier,
      },
    )
    return m
  }

  private async evaluateModule<T extends VMModule>(m: T): Promise<T> {
    if (m.status === 'unlinked') {
      this.esmLinkMap.set(
        m,
        m.link((identifier, referencer) =>
          this.resolveModule(identifier, referencer.identifier),
        ),
      )
    }

    await this.esmLinkMap.get(m)

    if (m.status === 'linked')
      await m.evaluate()

    return m
  }

  private findLongestRegisteredExtension(filename: string) {
    const name = basename(filename)
    let currentExtension: string
    let index: number
    let startIndex = 0
    // eslint-disable-next-line no-cond-assign
    while ((index = name.indexOf('.', startIndex)) !== -1) {
      startIndex = index + 1
      if (index === 0)
        continue // Skip dotfiles like .gitignore
      currentExtension = (name.slice(index))
      if (this.extensions[currentExtension])
        return currentExtension
    }
    return '.js'
  }

  public createRequire = (filename: string) => {
    const _require = createRequire(filename)
    const require = ((id: string) => {
      const resolved = _require.resolve(id)
      const ext = extname(resolved)
      if (ext === '.node' || isNodeBuiltin(resolved))
        return this.requireCoreModule(resolved)
      const module = this.createCommonJSNodeModule(resolved)
      return this.loadCommonJSModule(module, resolved)
    }) as NodeRequire
    require.resolve = _require.resolve
    Object.defineProperty(require, 'extensions', {
      get: () => this.extensions,
      set: () => {},
      configurable: true,
    })
    require.main = _require.main
    require.cache = this.requireCache
    return require
  }

  private createCommonJSNodeModule(filename: string) {
    return new this.Module(filename)
  }

  // very naive implementation for Node.js require
  private loadCommonJSModule(module: NodeModule, filename: string): Record<string, unknown> {
    const cached = this.requireCache[filename]
    if (cached)
      return cached.exports

    const extension = this.findLongestRegisteredExtension(filename)
    const loader = this.extensions[extension] || this.extensions['.js']
    loader(module, filename)

    return module.exports
  }

  private async createEsmModule(fileUrl: string, code: string) {
    const cached = this.moduleCache.get(fileUrl)
    if (cached)
      return cached
    const [urlPath] = fileUrl.split('?')
    if (CSS_LANGS_RE.test(urlPath) || KNOWN_ASSET_RE.test(urlPath)) {
      const path = normalize(urlPath)
      let name = path.split('/node_modules/').pop() || ''
      if (name?.startsWith('@'))
        name = name.split('/').slice(0, 2).join('/')
      else
        name = name.split('/')[0]
      const ext = extname(path)
      let error = `[vitest] Cannot import ${fileUrl}. At the moment, importing ${ext} files inside external dependencies is not allowed. `
      if (name) {
        const c = getColors()
        error += 'As a temporary workaround you can try to inline the package by updating your config:'
+ `\n\n${
c.gray(c.dim('// vitest.config.js'))
}\n${
c.green(`export default {
  test: {
    deps: {
      optimizer: {
        web: {
          include: [
            ${c.yellow(c.bold(`"${name}"`))}
          ]
        }
      }
    }
  }
}\n`)}`
      }
      throw new this.primitives.Error(error)
    }
    // TODO: should not be allowed in strict mode, implement in #2854
    if (fileUrl.endsWith('.json')) {
      const m = new SyntheticModule(
        ['default'],
        () => {
          const result = JSON.parse(code)
          m.setExport('default', result)
        },
      )
      this.moduleCache.set(fileUrl, m)
      return m
    }
    const m = new SourceTextModule(
      code,
      {
        identifier: fileUrl,
        context: this.context,
        importModuleDynamically: this.importModuleDynamically,
        initializeImportMeta: (meta, mod) => {
          meta.url = mod.identifier
          meta.resolve = (specifier: string, importer?: string) => {
            return nativeResolve(specifier, importer ?? mod.identifier)
          }
        },
      },
    )
    this.moduleCache.set(fileUrl, m)
    return m
  }

  private requireCoreModule(identifier: string) {
    const normalized = identifier.replace(/^node:/, '')
    if (this.builtinCache[normalized])
      return this.builtinCache[normalized].exports
    const moduleExports = _require(identifier)
    if (identifier === 'node:module' || identifier === 'module') {
      const module = new this.Module('/module.js') // path should not matter
      module.exports = this.Module
      this.builtinCache[normalized] = module
      return module.exports
    }
    this.builtinCache[normalized] = _require.cache[normalized]!
    return moduleExports
  }

  private async loadWebAssemblyModule(source: Buffer, identifier: string) {
    const cached = this.moduleCache.get(identifier)
    if (cached)
      return cached

    const wasmModule = await WebAssembly.compile(source)

    const exports = WebAssembly.Module.exports(wasmModule)
    const imports = WebAssembly.Module.imports(wasmModule)

    const moduleLookup: Record<string, VMModule> = {}
    for (const { module } of imports) {
      if (moduleLookup[module] === undefined) {
        const resolvedModule = await this.resolveModule(
          module,
          identifier,
        )

        moduleLookup[module] = await this.evaluateModule(resolvedModule)
      }
    }

    const syntheticModule = new SyntheticModule(
      exports.map(({ name }) => name),
      () => {
        const importsObject: WebAssembly.Imports = {}
        for (const { module, name } of imports) {
          if (!importsObject[module])
            importsObject[module] = {}

          importsObject[module][name] = (moduleLookup[module].namespace as any)[name]
        }
        const wasmInstance = new WebAssembly.Instance(
          wasmModule,
          importsObject,
        )
        for (const { name } of exports)
          syntheticModule.setExport(name, wasmInstance.exports[name])
      },
      { context: this.context, identifier },
    )

    return syntheticModule
  }

  private async createDataModule(identifier: string): Promise<VMModule> {
    const cached = this.moduleCache.get(identifier)
    if (cached)
      return cached

    const Error = this.primitives.Error
    const match = identifier.match(dataURIRegex)

    if (!match || !match.groups)
      throw new Error('Invalid data URI')

    const mime = match.groups.mime
    const encoding = match.groups.encoding

    if (mime === 'application/wasm') {
      if (!encoding)
        throw new Error('Missing data URI encoding')

      if (encoding !== 'base64')
        throw new Error(`Invalid data URI encoding: ${encoding}`)

      const module = await this.loadWebAssemblyModule(
        Buffer.from(match.groups.code, 'base64'),
        identifier,
      )
      this.moduleCache.set(identifier, module)
      return module
    }

    let code = match.groups.code
    if (!encoding || encoding === 'charset=utf-8')
      code = decodeURIComponent(code)

    else if (encoding === 'base64')
      code = Buffer.from(code, 'base64').toString()
    else
      throw new Error(`Invalid data URI encoding: ${encoding}`)

    if (mime === 'application/json') {
      const module = new SyntheticModule(
        ['default'],
        () => {
          const obj = JSON.parse(code)
          module.setExport('default', obj)
        },
        { context: this.context, identifier },
      )
      this.moduleCache.set(identifier, module)
      return module
    }

    return this.createEsmModule(identifier, code)
  }

  private async createModule(identifier: string): Promise<VMModule> {
    if (identifier.startsWith('data:'))
      return this.createDataModule(identifier)

    const extension = extname(identifier)

    if (extension === '.node' || isNodeBuiltin(identifier)) {
      const exports = this.requireCoreModule(identifier)
      return this.wrapCoreSynteticModule(identifier, exports)
    }

    const isFileUrl = identifier.startsWith('file://')
    const fileUrl = isFileUrl ? identifier : pathToFileURL(identifier).toString()
    const pathUrl = isFileUrl ? fileURLToPath(identifier.split('?')[0]) : identifier

    // TODO: support wasm in the future
    // if (extension === '.wasm') {
    //   const source = this.readBuffer(pathUrl)
    //   const wasm = this.loadWebAssemblyModule(source, fileUrl)
    //   this.moduleCache.set(fileUrl, wasm)
    //   return wasm
    // }

    if (extension === '.cjs') {
      const module = this.createCommonJSNodeModule(pathUrl)
      const exports = this.loadCommonJSModule(module, pathUrl)
      return this.wrapCommonJsSynteticModule(fileUrl, exports)
    }

    if (extension === '.mjs')
      return await this.createEsmModule(fileUrl, this.readFile(pathUrl))

    const pkgData = this.findNearestPackageData(normalize(pathUrl))

    if (pkgData.type === 'module')
      return await this.createEsmModule(fileUrl, this.readFile(pathUrl))

    const module = this.createCommonJSNodeModule(pathUrl)
    const exports = this.loadCommonJSModule(module, pathUrl)
    return this.wrapCommonJsSynteticModule(fileUrl, exports)
  }

  async import(identifier: string) {
    const module = await this.createModule(identifier)
    await this.evaluateModule(module)
    return module.namespace
  }
}

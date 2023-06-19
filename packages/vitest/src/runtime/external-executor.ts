import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname } from 'node:path'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve as resolveModule } from 'import-meta-resolve'
import { hasESMSyntax } from 'mlly'
import { extname } from 'pathe'
import { isNodeBuiltin } from 'vite-node/utils'

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

const _require = createRequire(import.meta.url)

// TODO: improve Node.js strict mode support in #2854
export class ExternalModulesExecutor {
  private context: vm.Context

  private requireCache: Record<string, NodeModule> = Object.create(null)
  private moduleCache = new Map<string, VMModule>()
  private extensions: Record<string, (m: NodeModule, filename: string) => string> = Object.create(null)

  private esmLinkMap = new WeakMap<VMModule, Promise<void>>()

  constructor(context: vm.Context) {
    this.context = context
    this.requireCache = Object.create(null)

    this.extensions['.js'] = this.requireJs
    this.extensions['.json'] = this.requireJson
  }

  private requireJs = (m: NodeModule, filename: string) => {
    return readFileSync(filename, 'utf-8')
  }

  private requireJson = (m: NodeModule, filename: string) => {
    const code = readFileSync(filename, 'utf-8')
    return `module.exports = ${code}`
  }

  importModuleDynamically = async (specifier: string, referencer: VMModule) => {
    const module = await this.resolveModule(specifier, referencer)
    return this.evaluateModule(module)
  }

  resolveModule = async (specifier: string, referencer: VMModule) => {
    const identifier = await this.resolveAsync(specifier, referencer.identifier)
    return await this.createModule(identifier)
  }

  async resolveAsync(specifier: string, parent: string) {
    return resolveModule(specifier, parent)
  }

  private async wrapSynteticModule(identifier: string, format: 'esm' | 'builtin' | 'cjs', exports: Record<string, unknown>) {
    const moduleKeys = Object.keys(exports)
    if (format !== 'esm' && !moduleKeys.includes('default'))
      moduleKeys.push('default')
    const m: any = new SyntheticModule(
      moduleKeys,
      () => {
        for (const key of moduleKeys)
          m.setExport(key, exports[key])
        if (format !== 'esm')
          m.setExport('default', exports)
      },
      {
        context: this.context,
        identifier,
      },
    )
    return m
  }

  async evaluateModule<T extends VMModule>(m: T): Promise<T> {
    if (m.status === 'unlinked') {
      this.esmLinkMap.set(
        m,
        m.link(this.resolveModule),
      )
    }

    await this.esmLinkMap.get(m)

    if (m.status === 'linked')
      await m.evaluate()

    return m
  }

  public createRequire = (filename: string) => {
    const _require = createRequire(filename)
    const require = ((id: string) => {
      const filename = _require.resolve(id)
      const ext = extname(filename)
      if (ext === '.node' || isNodeBuiltin(filename))
        return this.requireCoreModule(filename)
      const module = this.createCommonJSNodeModule(filename)
      return this.evaluateCommonJSModule(module, filename)
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
    const require = this.createRequire(filename)
    const __dirname = dirname(filename)
    // dirty non-spec implementation - doesn't support children, parent, etc
    const module: NodeModule = {
      exports: {},
      isPreloading: false,
      require,
      id: filename,
      filename,
      loaded: false,
      parent: null,
      children: [],
      path: __dirname,
      paths: [],
    }
    return module
  }

  // very naive implementation for Node.js require
  private evaluateCommonJSModule(module: NodeModule, filename: string): Record<string, unknown> {
    const cached = this.requireCache[filename]
    if (cached)
      return cached.exports

    const extension = extname(filename)
    const loader = this.extensions[extension] || this.extensions['.js']
    const result = loader(module, filename)

    const code = typeof result === 'string' ? result : ''

    const cjsModule = `(function (exports, require, module, __filename, __dirname) { ${code}\n})`
    const script = new vm.Script(cjsModule, {
      filename,
      importModuleDynamically: this.importModuleDynamically,
    } as any)
    // @ts-expect-error mark script with current identifier
    script.identifier = filename
    const fn = script.runInContext(this.context)
    const __dirname = dirname(filename)
    this.requireCache[filename] = module
    try {
      fn(module.exports, module.require, module, filename, __dirname)
      return module.exports
    }
    finally {
      module.loaded = true
    }
  }

  async createEsmModule(fileUrl: string, code: string) {
    const cached = this.moduleCache.get(fileUrl)
    if (cached)
      return cached
    const m = new SourceTextModule(
      code,
      {
        identifier: fileUrl,
        context: this.context,
        importModuleDynamically: this.importModuleDynamically,
        initializeImportMeta: (meta, mod) => {
          meta.url = mod.identifier
          // TODO: improve Node.js support with #2854
          // meta.resolve = (specifier: string, importer?: string) =>
          //   this.resolveAsync(specifier, importer ?? mod.identifier)
        },
      },
    )
    this.moduleCache.set(fileUrl, m)
    return m
  }

  private requireCoreModule(identifier: string) {
    const normalized = identifier.replace(/^node:/, '')
    if (this.requireCache[normalized])
      return this.requireCache[normalized].exports
    const moduleExports = _require(identifier)
    if (identifier === 'node:module' || identifier === 'module') {
      const exports = { ...moduleExports, createRequire: this.createRequire }
      const cached = _require.cache[normalized]!
      this.requireCache[normalized] = { ...cached, exports }
      return exports
    }
    this.requireCache[normalized] = _require.cache[normalized]!
    return moduleExports
  }

  private getIdentifierCode(code: string) {
    if (code.startsWith('data:text/javascript'))
      return code.match(/data:text\/javascript;.*,(.*)/)?.[1]
  }

  async createModule(identifier: string): Promise<VMModule> {
    const extension = extname(identifier)

    if (extension === '.node' || isNodeBuiltin(identifier)) {
      const exports = this.requireCoreModule(identifier)
      return await this.wrapSynteticModule(identifier, 'builtin', exports)
    }

    const isFileUrl = identifier.startsWith('file://')
    const fileUrl = isFileUrl ? identifier : pathToFileURL(identifier).toString()
    const pathUrl = isFileUrl ? fileURLToPath(identifier) : identifier
    const inlineCode = this.getIdentifierCode(identifier)
    const code = inlineCode || await readFile(pathUrl, 'utf-8')

    // TODO: very dirty check for cjs, it should actually check filepath and package.json, improve in #2854
    if (!inlineCode && (extension === '.cjs' || !hasESMSyntax(code))) {
      const module = this.createCommonJSNodeModule(pathUrl)
      const exports = this.evaluateCommonJSModule(module, pathUrl)
      return this.wrapSynteticModule(fileUrl, 'cjs', exports)
    }

    return await this.createEsmModule(fileUrl, code)
  }

  async import(identifier: string) {
    const module = await this.createModule(identifier)
    await this.evaluateModule(module)
    return module.namespace
  }
}

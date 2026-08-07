import type vm from 'node:vm'
import type { RuntimeRPC } from '../types/rpc'
import type { CodeCache } from './vm/code-cache'
import type { FileMap } from './vm/file-map'
import type { VMModule } from './vm/types'
import fs from 'node:fs'
import { isBuiltin } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isBareImport, splitFileAndPostfix } from '@vitest/utils/helpers'
import { lookupPackageScopeType } from '@vitest/utils/resolver'
import { extname, normalize } from 'pathe'
import { CommonjsExecutor } from './vm/commonjs-executor'
import { EsmExecutor } from './vm/esm-executor'
import {
  createRequireAsyncModuleError,
  hasEsmSyntax,
  setActiveVmExecutor,
  supportsSyncEsmEvaluate,
} from './vm/utils'
import { ViteExecutor } from './vm/vite-executor'

const { existsSync } = fs

// always defined when we use vm pool
const nativeResolve = import.meta.resolve!

// a relative ESM specifier resolves by plain URL join — Node's resolver adds
// no information for these (it does not check existence and relative
// specifiers never consult package.json), but it re-derives the package
// scope on every uncached call, re-parsing large `exports` maps. Restricted
// to a conservative charset so anything URL-special falls back to Node.
const SIMPLE_RELATIVE_SPECIFIER_RE = /^\.{1,2}\/[\w\-./]+$/

export interface ExternalModulesExecutorOptions {
  context: vm.Context
  fileMap: FileMap
  codeCache?: CodeCache
  resolveCache?: Map<string, string>
  moduleInfoCache?: Map<string, ModuleInformation>
  packageCache: Map<string, any>
  transform: RuntimeRPC['transform']
  interopDefault?: boolean
  viteClientModule: Record<string, unknown>
}

export interface ModuleInformation {
  type:
    | 'data'
    | 'builtin'
    | 'vite'
    | 'wasm'
    | 'module'
    | 'commonjs'
    | 'network'
  url: string
  path: string
  exists?: boolean
}

// how the sync require(esm) graph walker should treat a resolved module:
// 'ready' modules are complete synthetic modules (builtins, CJS files),
// 'source'/'json' carry the raw content for the walker to build itself
export type SyncModuleDisposition
  = | { kind: 'ready'; module: VMModule }
    | { kind: 'json'; code: string }
    | { kind: 'source'; code: string }

// TODO: improve Node.js strict mode support in #2854
export class ExternalModulesExecutor {
  private cjs: CommonjsExecutor
  private esm: EsmExecutor
  private vite: ViteExecutor
  private context: vm.Context
  private fs: FileMap
  public readonly codeCache: CodeCache | undefined
  private resolvers: ((id: string, parent: string) => string | undefined)[]
    = []

  #networkSupported: boolean | null = null

  constructor(private options: ExternalModulesExecutorOptions) {
    this.context = options.context

    this.fs = options.fileMap
    this.codeCache = options.codeCache
    this.esm = new EsmExecutor(this, {
      context: this.context,
    })
    setActiveVmExecutor(this)
    this.cjs = new CommonjsExecutor({
      context: this.context,
      fileMap: options.fileMap,
      codeCache: options.codeCache,
      interopDefault: options.interopDefault,
      shouldRequireAsEsm: this.shouldRequireAsEsm,
      requireEsm: this.requireEsm,
    })
    this.vite = new ViteExecutor({
      esmExecutor: this.esm,
      context: this.context,
      transform: options.transform,
      viteClientModule: options.viteClientModule,
    })
    this.resolvers = [this.vite.resolve]
  }

  async import(identifier: string): Promise<object> {
    const module = await this.createModule(identifier)
    await this.esm.evaluateModule(module)
    return module.namespace
  }

  require(identifier: string): any {
    return this.cjs.require(identifier)
  }

  createRequire(identifier: string): NodeJS.Require {
    return this.cjs.createRequire(identifier)
  }

  #esmSyntaxCache = new Map<string, boolean>()

  // require() dispatches to the sync ESM loader only for files that are
  // explicitly marked as ESM (.mjs or a "type": "module" package scope).
  // JSON files keep the CJS json loader for Node require() parity — the
  // extension wins over the package scope.
  private shouldRequireAsEsm = (resolvedPath: string): boolean => {
    if (!supportsSyncEsmEvaluate) {
      return false
    }
    const information = this.getModuleInformation(resolvedPath)
    if (information.type !== 'module' || information.path.endsWith('.json')) {
      return false
    }
    if (information.path.endsWith('.mjs')) {
      return true
    }
    // A .js file in an ESM package scope may still contain plain CJS code —
    // Node evaluates it as ESM with injected CJS module variables (module,
    // require, __filename), which a vm SourceTextModule cannot emulate.
    // Files without ESM syntax keep loading through the CJS executor; a
    // false negative here is corrected by its ESM-syntax fallback.
    let syntax = this.#esmSyntaxCache.get(information.path)
    if (syntax == null) {
      syntax = hasEsmSyntax(this.fs.readFile(information.path))
      this.#esmSyntaxCache.set(information.path, syntax)
    }
    return syntax
  }

  private requireEsm = (resolvedPath: string): unknown => {
    const { url } = this.getModuleInformation(resolvedPath)
    const module = this.esm.requireEsModuleSync(url)
    const namespace = module.namespace as Record<string, unknown>
    // Node parity: an ES module can define its own require() result with an
    // export named "module.exports"
    return 'module.exports' in namespace
      ? namespace['module.exports']
      : namespace
  }

  public resolveSyncSpecifier = (
    specifier: string,
    referencer: string,
  ): string => {
    const resolved = this.resolve(specifier, referencer) as
      | string
      | Promise<string>
    if (resolved instanceof Promise) {
      throw createRequireAsyncModuleError(
        referencer,
        `"${specifier}" cannot be resolved synchronously`,
      )
    }
    return resolved
  }

  // the sync counterpart of `createModule`, used by the require(esm) graph
  // walker. `forceEsmSource` loads a 'commonjs'-typed file as ES module
  // source — the CJS executor requests this after its parser rejected a .js
  // file that contains ESM syntax.
  public materializeSyncModule = (
    identifier: string,
    forceEsmSource: boolean,
  ): SyncModuleDisposition => {
    const information = this.getModuleInformation(identifier)
    const { type, path } = information
    this.assertModuleExists(information)

    switch (type) {
      case 'builtin':
        return {
          kind: 'ready',
          module: this.cjs.getCoreSyntheticModule(identifier),
        }
      case 'module':
      case 'commonjs': {
        if (type === 'commonjs' && !forceEsmSource) {
          return {
            kind: 'ready',
            module: this.cjs.getCjsSyntheticModule(path, identifier),
          }
        }
        if (path.endsWith('.json')) {
          return { kind: 'json', code: this.fs.readFile(path) }
        }
        return { kind: 'source', code: this.fs.readFile(path) }
      }
      case 'data':
        // data: URIs are materialized by the ESM executor before it consults
        // the external executor
        throw new Error(
          `[vitest] Unexpected data: module ${identifier} in the sync module walker. This is a bug in Vitest.`,
        )
      case 'vite':
        throw createRequireAsyncModuleError(
          identifier,
          'the module is transformed by Vite, which is asynchronous',
        )
      case 'wasm':
        throw createRequireAsyncModuleError(
          identifier,
          'WebAssembly modules cannot be loaded synchronously',
        )
      case 'network':
        throw createRequireAsyncModuleError(
          identifier,
          'network modules cannot be loaded synchronously',
        )
      default: {
        const _deadend: never = type
        return _deadend
      }
    }
  }

  // dynamic import can be used in both ESM and CJS, so we have it in the executor
  public importModuleDynamically = async (
    specifier: string,
    referencer: VMModule,
  ): Promise<VMModule> => {
    const module = await this.resolveModule(specifier, referencer.identifier)
    return await this.esm.evaluateModule(module)
  }

  public resolveModule = async (specifier: string, referencer: string): Promise<VMModule> => {
    let identifier = this.resolve(specifier, referencer) as
      | string
      | Promise<string>

    if (identifier instanceof Promise) {
      identifier = await identifier
    }

    return await this.createModule(identifier)
  }

  public resolve(specifier: string, parent: string): string {
    for (const resolver of this.resolvers) {
      const id = resolver(specifier, parent)
      if (id) {
        return id
      }
    }

    if (
      SIMPLE_RELATIVE_SPECIFIER_RE.test(specifier)
      && parent.startsWith('file://')
    ) {
      return new URL(specifier, parent).href
    }

    // resolution of externalized modules is stable for the lifetime of the
    // worker (like fileMap/packageCache), while fresh vm contexts re-resolve
    // every import edge
    const cache = this.options.resolveCache
    const key = cache ? `${parent}\n${specifier}` : undefined
    if (cache) {
      const cached = cache.get(key!)
      if (cached !== undefined) {
        return cached
      }
    }

    // import.meta.resolve can be asynchronous in older +18 Node versions
    const resolved = nativeResolve(specifier, parent)
    if (cache && typeof resolved === 'string') {
      cache.set(key!, resolved)
    }
    return resolved
  }

  private getModuleInformation(identifier: string): ModuleInformation {
    const cached = this.options.moduleInfoCache?.get(identifier)
    if (cached) {
      return cached
    }
    const info = this.resolveModuleInformation(identifier)
    this.options.moduleInfoCache?.set(identifier, info)
    return info
  }

  private resolveModuleInformation(identifier: string): ModuleInformation {
    if (identifier.startsWith('data:')) {
      return { type: 'data', url: identifier, path: identifier }
    }

    const { file, postfix } = splitFileAndPostfix(identifier)
    const extension = extname(file)
    if (extension === '.node' || isBuiltin(identifier)) {
      return { type: 'builtin', url: identifier, path: identifier }
    }

    if (
      this.isNetworkSupported
      && (identifier.startsWith('http:') || identifier.startsWith('https:'))
    ) {
      return { type: 'network', url: identifier, path: identifier }
    }

    const isFileUrl = identifier.startsWith('file://')
    const pathUrl = isFileUrl ? fileURLToPath(file) : file
    const fileUrl = isFileUrl ? identifier : `${pathToFileURL(file)}${postfix}`

    let type: 'module' | 'commonjs' | 'vite' | 'wasm'
    if (this.vite.canResolve(fileUrl)) {
      type = 'vite'
    }
    else if (extension === '.mjs') {
      type = 'module'
    }
    else if (extension === '.cjs') {
      type = 'commonjs'
    }
    else if (extension === '.wasm') {
      // still experimental on NodeJS --experimental-wasm-modules
      // cf. ESM_FILE_FORMAT(url) in https://nodejs.org/docs/latest-v20.x/api/esm.html#resolution-algorithm
      type = 'wasm'
    }
    else {
      type = lookupPackageScopeType(normalize(pathUrl)) === 'esm' ? 'module' : 'commonjs'
    }

    return { type, path: pathUrl, url: fileUrl }
  }

  // create ERR_MODULE_NOT_FOUND on our own since latest NodeJS's import.meta.resolve doesn't throw on non-existing namespace or path
  // https://github.com/nodejs/node/pull/49038
  private assertModuleExists(information: ModuleInformation): void {
    const { type, path } = information
    if (type === 'module' || type === 'commonjs' || type === 'wasm') {
      information.exists ??= existsSync(path)
    }
    if (information.exists === false) {
      const error: NodeJS.ErrnoException = new Error(`Cannot find ${isBareImport(path) ? 'package' : 'module'} '${path}'`)
      error.code = 'ERR_MODULE_NOT_FOUND'
      throw error
    }
  }

  private createModule(identifier: string): VMModule | Promise<VMModule> {
    const information = this.getModuleInformation(identifier)
    const { type, url, path } = information

    this.assertModuleExists(information)

    switch (type) {
      case 'data':
        return this.esm.createDataModule(identifier)
      case 'builtin':
        return this.cjs.getCoreSyntheticModule(identifier)
      case 'vite':
        return this.vite.createViteModule(url)
      case 'wasm':
        return this.esm.createWebAssemblyModule(url, () => this.fs.readBuffer(path))
      case 'module':
        return this.esm.createEsModule(url, () => this.fs.readFile(path))
      case 'commonjs':
        return this.cjs.getCjsSyntheticModule(path, identifier)
      case 'network':
        return this.esm.createNetworkModule(url)
      default: {
        const _deadend: never = type
        return _deadend
      }
    }
  }

  private get isNetworkSupported() {
    if (this.#networkSupported == null) {
      if (process.execArgv.includes('--experimental-network-imports')) {
        this.#networkSupported = true
      }
      else if (
        process.env.NODE_OPTIONS?.includes('--experimental-network-imports')
      ) {
        this.#networkSupported = true
      }
      else {
        this.#networkSupported = false
      }
    }
    return this.#networkSupported
  }
}

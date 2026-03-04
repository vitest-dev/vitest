import type vm from 'node:vm'
import type { RuntimeRPC } from '../types/rpc'
import type { FileMap } from './vm/file-map'
import type { VMModule } from './vm/types'
import fs from 'node:fs'
import { isBuiltin } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isBareImport } from '@vitest/utils/helpers'
import { findNearestPackageData } from '@vitest/utils/resolver'
import { extname, normalize } from 'pathe'
import { CommonjsExecutor } from './vm/commonjs-executor'
import { EsmExecutor } from './vm/esm-executor'
import { ViteExecutor } from './vm/vite-executor'

const { existsSync } = fs

// always defined when we use vm pool
const nativeResolve = import.meta.resolve!

export interface ExternalModulesExecutorOptions {
  context: vm.Context
  fileMap: FileMap
  packageCache: Map<string, any>
  transform: RuntimeRPC['transform']
  interopDefault?: boolean
  viteClientModule: Record<string, unknown>
}

interface ModuleInformation {
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
}

// TODO: improve Node.js strict mode support in #2854
export class ExternalModulesExecutor {
  private cjs: CommonjsExecutor
  private esm: EsmExecutor
  private vite: ViteExecutor
  private context: vm.Context
  private fs: FileMap
  private resolvers: ((id: string, parent: string) => string | undefined)[]
    = []

  #networkSupported: boolean | null = null

  constructor(private options: ExternalModulesExecutorOptions) {
    this.context = options.context

    this.fs = options.fileMap
    this.esm = new EsmExecutor(this, {
      context: this.context,
    })
    this.cjs = new CommonjsExecutor({
      context: this.context,
      importModuleDynamically: this.importModuleDynamically,
      fileMap: options.fileMap,
      interopDefault: options.interopDefault,
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

    // import.meta.resolve can be asynchronous in older +18 Node versions
    return nativeResolve(specifier, parent)
  }

  private getModuleInformation(identifier: string): ModuleInformation {
    if (identifier.startsWith('data:')) {
      return { type: 'data', url: identifier, path: identifier }
    }

    const extension = extname(identifier)
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
    const pathUrl = isFileUrl
      ? fileURLToPath(identifier.split('?')[0])
      : identifier
    const fileUrl = isFileUrl ? identifier : pathToFileURL(pathUrl).toString()

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
      const pkgData = findNearestPackageData(normalize(pathUrl))
      type = pkgData.type === 'module' ? 'module' : 'commonjs'
    }

    return { type, path: pathUrl, url: fileUrl }
  }

  private createModule(identifier: string): VMModule | Promise<VMModule> {
    const { type, url, path } = this.getModuleInformation(identifier)

    // create ERR_MODULE_NOT_FOUND on our own since latest NodeJS's import.meta.resolve doesn't throw on non-existing namespace or path
    // https://github.com/nodejs/node/pull/49038
    if (
      (type === 'module' || type === 'commonjs' || type === 'wasm')
      && !existsSync(path)
    ) {
      const error = new Error(`Cannot find ${isBareImport(path) ? 'package' : 'module'} '${path}'`);
      (error as any).code = 'ERR_MODULE_NOT_FOUND'
      throw error
    }

    switch (type) {
      case 'data':
        return this.esm.createDataModule(identifier)
      case 'builtin':
        return this.cjs.getCoreSyntheticModule(identifier)
      case 'vite':
        return this.vite.createViteModule(url)
      case 'wasm':
        return this.esm.createWebAssemblyModule(url, () =>
          this.fs.readBuffer(path))
      case 'module':
        return this.esm.createEsModule(url, () =>
          this.fs.readFileAsync(path))
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

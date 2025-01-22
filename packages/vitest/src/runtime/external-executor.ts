import type { RuntimeRPC } from '../types/rpc'
import type { FileMap } from './vm/file-map'
import type { VMModule, VMSyntheticModule } from './vm/types'
import fs from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'
import { extname, join, normalize } from 'pathe'
import { getCachedData, isNodeBuiltin, setCacheData } from 'vite-node/utils'
import { CommonjsExecutor } from './vm/commonjs-executor'
import { EsmExecutor } from './vm/esm-executor'
import { interopCommonJsModule } from './vm/utils'
import { ViteExecutor } from './vm/vite-executor'

const SyntheticModule: typeof VMSyntheticModule = (vm as any).SyntheticModule

const { existsSync, statSync } = fs

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
  private resolvers: ((id: string, parent: string) => string | undefined)[] = []

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
    })
    this.vite = new ViteExecutor({
      esmExecutor: this.esm,
      context: this.context,
      transform: options.transform,
      viteClientModule: options.viteClientModule,
    })
    this.resolvers = [this.vite.resolve]
  }

  async import(identifier: string) {
    const module = await this.createModule(identifier)
    await this.esm.evaluateModule(module)
    return module.namespace
  }

  require(identifier: string) {
    return this.cjs.require(identifier)
  }

  createRequire(identifier: string) {
    return this.cjs.createRequire(identifier)
  }

  // dynamic import can be used in both ESM and CJS, so we have it in the executor
  public importModuleDynamically = async (
    specifier: string,
    referencer: VMModule,
  ) => {
    const module = await this.resolveModule(specifier, referencer.identifier)
    return await this.esm.evaluateModule(module)
  }

  public resolveModule = async (specifier: string, referencer: string) => {
    let identifier = this.resolve(specifier, referencer) as
      | string
      | Promise<string>

    if (identifier instanceof Promise) {
      identifier = await identifier
    }

    return await this.createModule(identifier)
  }

  public resolve(specifier: string, parent: string) {
    for (const resolver of this.resolvers) {
      const id = resolver(specifier, parent)
      if (id) {
        return id
      }
    }

    // import.meta.resolve can be asynchronous in older +18 Node versions
    return nativeResolve(specifier, parent)
  }

  private findNearestPackageData(basedir: string): {
    type?: 'module' | 'commonjs'
  } {
    const originalBasedir = basedir
    const packageCache = this.options.packageCache
    while (basedir) {
      const cached = getCachedData(packageCache, basedir, originalBasedir)
      if (cached) {
        return cached
      }

      const pkgPath = join(basedir, 'package.json')
      try {
        if (statSync(pkgPath, { throwIfNoEntry: false })?.isFile()) {
          const pkgData = JSON.parse(this.fs.readFile(pkgPath))

          if (packageCache) {
            setCacheData(packageCache, pkgData, basedir, originalBasedir)
          }

          return pkgData
        }
      }
      catch {}

      const nextBasedir = dirname(basedir)
      if (nextBasedir === basedir) {
        break
      }
      basedir = nextBasedir
    }

    return {}
  }

  private wrapCoreSyntheticModule(
    identifier: string,
    exports: Record<string, unknown>,
  ) {
    const moduleKeys = Object.keys(exports)
    const m = new SyntheticModule(
      [...moduleKeys, 'default'],
      () => {
        for (const key of moduleKeys) {
          m.setExport(key, exports[key])
        }
        m.setExport('default', exports)
      },
      {
        context: this.context,
        identifier,
      },
    )
    return m
  }

  private wrapCommonJsSynteticModule(
    identifier: string,
    exports: Record<string, unknown>,
  ) {
    // TODO: technically module should be parsed to find static exports, implement for strict mode in #2854
    const { keys, moduleExports, defaultExport } = interopCommonJsModule(
      this.options.interopDefault,
      exports,
    )
    const m = new SyntheticModule(
      [...keys, 'default'],
      () => {
        for (const key of keys) {
          m.setExport(key, moduleExports[key])
        }
        m.setExport('default', defaultExport)
      },
      {
        context: this.context,
        identifier,
      },
    )
    return m
  }

  private getModuleInformation(identifier: string): ModuleInformation {
    if (identifier.startsWith('data:')) {
      return { type: 'data', url: identifier, path: identifier }
    }

    const extension = extname(identifier)
    if (extension === '.node' || isNodeBuiltin(identifier)) {
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
      const pkgData = this.findNearestPackageData(normalize(pathUrl))
      type = pkgData.type === 'module' ? 'module' : 'commonjs'
    }

    return { type, path: pathUrl, url: fileUrl }
  }

  private async createModule(identifier: string): Promise<VMModule> {
    const { type, url, path } = this.getModuleInformation(identifier)

    // create ERR_MODULE_NOT_FOUND on our own since latest NodeJS's import.meta.resolve doesn't throw on non-existing namespace or path
    // https://github.com/nodejs/node/pull/49038
    if (
      (type === 'module' || type === 'commonjs' || type === 'wasm')
      && !existsSync(path)
    ) {
      const error = new Error(`Cannot find module '${path}'`);
      (error as any).code = 'ERR_MODULE_NOT_FOUND'
      throw error
    }

    switch (type) {
      case 'data':
        return await this.esm.createDataModule(identifier)
      case 'builtin': {
        const exports = this.require(identifier)
        return this.wrapCoreSyntheticModule(identifier, exports)
      }
      case 'vite':
        return await this.vite.createViteModule(url)
      case 'wasm':
        return await this.esm.createWebAssemblyModule(url, () =>
          this.fs.readBuffer(path))
      case 'module':
        return await this.esm.createEsModule(url, () =>
          this.fs.readFileAsync(path))
      case 'commonjs': {
        const exports = this.require(path)
        return this.wrapCommonJsSynteticModule(identifier, exports)
      }
      case 'network':
        return await this.esm.createNetworkModule(url)
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

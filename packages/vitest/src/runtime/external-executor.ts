/* eslint-disable antfu/no-cjs-exports */

import type vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname } from 'node:path'
import { statSync } from 'node:fs'
import { extname, join, normalize } from 'pathe'
import * as cjsLexer from 'cjs-module-lexer'
import { getCachedData, isNodeBuiltin, setCacheData } from 'vite-node/utils'
import type { WorkerGlobalState } from '../types/worker'
import type { ExecuteOptions } from './execute'
import type { CreateModuleOptions, ModuleFormat, VMModule } from './vm/types'
import { CommonjsExecutor } from './vm/commonjs-executor'
import type { FileMap } from './vm/file-map'
import { EsmExecutor } from './vm/esm-executor'
import { SyntheticModule, interopCommonJsModule, isStrictNode } from './vm/utils'
import { ViteExecutor } from './vm/vite-executor'
import { validateAssertion } from './vm/validate-assertion'

let lexerInitialized = false

const nativeResolve = import.meta.resolve!

export interface ExternalModulesExecutorOptions extends ExecuteOptions {
  context: vm.Context
  fileMap: FileMap
  packageCache: Map<string, any>
}

interface ModuleInformation {
  format: ModuleFormat
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
      viteClientModule: options.requestStubs!['/@vite/client'],
    })
    this.resolvers = [this.vite.resolve]
  }

  get workerState(): WorkerGlobalState {
    return this.options.context.__vitest_worker__
  }

  // dynamic import can be used in both ESM and CJS, so we have it in the executor
  public importModuleDynamically = async (specifier: string, referencer: VMModule, importAssertions: Object) => {
    const module = await this.resolveModule(
      specifier,
      referencer.identifier,
      { assert: importAssertions as ImportAssertions, $_referencer: referencer.identifier },
    )
    return this.esm.evaluateModule(module)
  }

  public resolveModule = async (specifier: string, referencer: string, options: CreateModuleOptions = {}) => {
    const identifier = await this.resolve(specifier, referencer)
    options.$_referencer ??= referencer
    return await this.createModule(identifier, options)
  }

  public async resolve(specifier: string, parent: string) {
    for (const resolver of this.resolvers) {
      const id = resolver(specifier, parent)
      if (id)
        return id
    }
    return nativeResolve(specifier, parent)
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
          const pkgData = JSON.parse(this.fs.readFile(pkgPath))

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
    const m = new SyntheticModule(
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

  prepareCommonJsModule(identifier: string, moduleExports: any) {
    if (this.workerState.environment.name === 'node') {
      const options = this.workerState.config.environmentOptions.node || {}
      if (options.strict) {
        const content = this.fs.readFile(fileURLToPath(identifier))
        const { exports, reexports } = cjsLexer.parse(content)
        const keys = new Set([...exports, ...reexports])
        keys.delete('default')
        return { keys, moduleExports, defaultExport: moduleExports }
      }
    }
    return interopCommonJsModule(this.options.interopDefault, moduleExports)
  }

  private wrapCommonJsSynteticModule(identifier: string, exports: any) {
    const { keys, moduleExports, defaultExport } = this.prepareCommonJsModule(identifier, exports)
    const m = new SyntheticModule(
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

  public getModuleInformation(identifier: string): ModuleInformation {
    if (identifier.startsWith('data:'))
      return { format: 'data', url: identifier, path: identifier }

    const extension = extname(identifier)

    if (extension === 'json')
      return { format: 'json', url: identifier, path: identifier }

    if (extension === '.node' || isNodeBuiltin(identifier))
      return { format: 'builtin', url: identifier, path: identifier }

    const isFileUrl = identifier.startsWith('file://')
    const pathUrl = isFileUrl ? fileURLToPath(identifier.split('?')[0]) : identifier
    const fileUrl = isFileUrl ? identifier : pathToFileURL(pathUrl).toString()

    let format: ModuleFormat
    if (this.vite.canResolve(fileUrl)) {
      format = 'vite'
    }
    else if (extension === '.mjs') {
      format = 'module'
    }
    else if (extension === '.cjs') {
      format = 'commonjs'
    }
    else if (extension === '.wasm') {
      format = 'wasm'
    }
    else {
      const pkgData = this.findNearestPackageData(normalize(pathUrl))
      format = pkgData.type === 'module' ? 'module' : 'commonjs'
    }

    return { format, path: pathUrl, url: fileUrl }
  }

  private async createModule(identifier: string, options?: CreateModuleOptions): Promise<VMModule> {
    const { format: type, url, path } = this.getModuleInformation(identifier)

    if (isStrictNode(this.workerState)) {
      validateAssertion(url, type, options)

      if (!lexerInitialized) {
        await cjsLexer.init()
        lexerInitialized = true
      }
    }

    switch (type) {
      case 'wasm':
        throw new Error('[vitest] WebAssembly is not supported yet. Please, open a new issue if you rely on it.')
      case 'data':
        return this.esm.createDataModule(identifier)
      case 'builtin': {
        const exports = this.require(identifier)
        return this.wrapCoreSynteticModule(identifier, exports)
      }
      case 'vite':
        return await this.vite.createViteModule(url)
      case 'json':
        return this.esm.createJsonModule(url, this.fs.readFile(path))
      case 'module':
        return await this.esm.createEsModule(url, this.fs.readFile(path))
      case 'commonjs': {
        const exports = this.require(path)
        return this.wrapCommonJsSynteticModule(identifier, exports)
      }
      default: {
        const _deadend: never = type
        return _deadend
      }
    }
  }

  async import(identifier: string, options?: CreateModuleOptions) {
    const module = await this.createModule(identifier, options)
    await this.esm.evaluateModule(module)
    return module.namespace
  }

  require(identifier: string) {
    return this.cjs.require(identifier)
  }

  createRequire(identifier: string) {
    return this.cjs.createRequire(identifier)
  }
}

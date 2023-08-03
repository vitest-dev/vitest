/* eslint-disable antfu/no-cjs-exports */

import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname } from 'node:path'
import { statSync } from 'node:fs'
import { extname, join, normalize } from 'pathe'
import { getCachedData, isNodeBuiltin, setCacheData } from 'vite-node/utils'
import type { ExecuteOptions } from './execute'
import type { VMModule, VMSyntheticModule } from './vm/types'
import { CommonjsExecutor } from './vm/commonjs-executor'
import type { FileMap } from './vm/file-map'
import { EsmExecutor } from './vm/esm-executor'
import { interopCommonJsModule } from './vm/utils'

const SyntheticModule: typeof VMSyntheticModule = (vm as any).SyntheticModule

const nativeResolve = import.meta.resolve!

export interface ExternalModulesExecutorOptions extends ExecuteOptions {
  context: vm.Context
  fileMap: FileMap
  packageCache: Map<string, any>
}

// TODO: improve Node.js strict mode support in #2854
export class ExternalModulesExecutor {
  private cjs: CommonjsExecutor
  private esm: EsmExecutor
  private context: vm.Context
  private fs: FileMap

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
  }

  // dynamic import can be used in both ESM and CJS, so we have it in the executor
  public importModuleDynamically = async (specifier: string, referencer: VMModule) => {
    const module = await this.resolveModule(specifier, referencer.identifier)
    return this.esm.evaluateModule(module)
  }

  public resolveModule = async (specifier: string, referencer: string) => {
    const identifier = await this.resolveId(specifier, referencer)
    return await this.createModule(identifier)
  }

  public async resolveId(specifier: string, parent: string) {
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

  private wrapCommonJsSynteticModule(identifier: string, exports: Record<string, unknown>) {
    // TODO: technically module should be parsed to find static exports, implement for strict mode in #2854
    const { keys, moduleExports, defaultExport } = interopCommonJsModule(this.options.interopDefault, exports)
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

  private async createModule(identifier: string): Promise<VMModule> {
    if (identifier.startsWith('data:'))
      return this.esm.createDataModule(identifier)

    const extension = extname(identifier)

    if (extension === '.node' || isNodeBuiltin(identifier)) {
      const exports = this.require(identifier)
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
      const exports = this.require(pathUrl)
      return this.wrapCommonJsSynteticModule(fileUrl, exports)
    }

    if (extension === '.mjs')
      return await this.esm.createEsmModule(fileUrl, this.fs.readFile(pathUrl))

    const pkgData = this.findNearestPackageData(normalize(pathUrl))

    if (pkgData.type === 'module')
      return await this.esm.createEsmModule(fileUrl, this.fs.readFile(pathUrl))

    const exports = this.cjs.require(pathUrl)
    return this.wrapCommonJsSynteticModule(fileUrl, exports)
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
}

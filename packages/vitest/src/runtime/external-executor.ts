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
import { ViteExecutor } from './vm/vite-executor'

const SyntheticModule: typeof VMSyntheticModule = (vm as any).SyntheticModule

const nativeResolve = import.meta.resolve!

export interface ExternalModulesExecutorOptions extends ExecuteOptions {
  context: vm.Context
  fileMap: FileMap
  packageCache: Map<string, any>
}

interface ModuleInformation {
  type: 'data' | 'builtin' | 'vite' | 'module' | 'commonjs'
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

  // dynamic import can be used in both ESM and CJS, so we have it in the executor
  public importModuleDynamically = async (specifier: string, referencer: VMModule) => {
    const module = await this.resolveModule(specifier, referencer.identifier)
    return this.esm.evaluateModule(module)
  }

  public resolveModule = async (specifier: string, referencer: string) => {
    const identifier = await this.resolve(specifier, referencer)
    return await this.createModule(identifier)
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

  private getModuleInformation(identifier: string): ModuleInformation {
    if (identifier.startsWith('data:'))
      return { type: 'data', url: identifier, path: identifier }

    const extension = extname(identifier)
    if (extension === '.node' || isNodeBuiltin(identifier))
      return { type: 'builtin', url: identifier, path: identifier }

    const isFileUrl = identifier.startsWith('file://')
    const pathUrl = isFileUrl ? fileURLToPath(identifier.split('?')[0]) : identifier
    const fileUrl = isFileUrl ? identifier : pathToFileURL(pathUrl).toString()

    let type: 'module' | 'commonjs' | 'vite'
    if (this.vite.canResolve(fileUrl)) {
      type = 'vite'
    }
    else if (extension === '.mjs') {
      type = 'module'
    }
    else if (extension === '.cjs') {
      type = 'commonjs'
    }
    else {
      const pkgData = this.findNearestPackageData(normalize(pathUrl))
      type = pkgData.type === 'module' ? 'module' : 'commonjs'
    }

    return { type, path: pathUrl, url: fileUrl }
  }

  private async createModule(identifier: string): Promise<VMModule> {
    const { type, url, path } = this.getModuleInformation(identifier)

    switch (type) {
      case 'data':
        return this.esm.createDataModule(identifier)
      case 'builtin': {
        const exports = this.require(identifier)
        return this.wrapCoreSynteticModule(identifier, exports)
      }
      case 'vite':
        return await this.vite.createViteModule(url)
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

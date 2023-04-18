import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname } from 'node:path'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve as resolveModule } from 'import-meta-resolve'
import { hasESMSyntax } from 'mlly'
import { extname } from 'pathe'
import { isNodeBuiltin } from './utils'

const _require = createRequire(import.meta.url)

export class NativeNodeVmClient {
  private context: vm.Context

  private requireCache = _require.cache
  private moduleCache = new Map<string, Promise<vm.Module>>()

  constructor(context: vm.Context) {
    this.context = context
  }

  importModuleDynamically = async (specifier: string, script: vm.Module) => {
    const identifier = await this.resolveAsync(specifier, script.identifier)
    const { module } = await this.evaluateImport(identifier)
    return module
  }

  async resolveAsync(specifier: string, parent: string) {
    return resolveModule(specifier, parent)
  }

  private wrapSynteticModule(identifier: string, format: 'esm' | 'builtin' | 'cjs', exports: Record<string, unknown>) {
    const moduleKeys = Object.keys(exports)
    const m: any = new vm.SyntheticModule(
      // TODO: fix "default" shenanigans
      Array.from(new Set([...moduleKeys, 'default'])),
      () => {
        for (const key of moduleKeys)
          m.setExport(key, exports[key])
        if (format !== 'esm' && !moduleKeys.includes('default'))
          m.setExport('default', exports)
      },
      {
        context: this.context,
        identifier,
      },
    )
    return m
  }

  private async evaluateModule<T extends vm.Module>(m: T): Promise<T> {
    if (m.status === 'unlinked')
      await m.link(this.importModuleDynamically)

    if (m.status === 'linked')
      await m.evaluate()

    return m
  }

  private createCjsModule(filename: string) {
    const _require = createRequire(filename)
    // doesn't respect "extensions"
    const require: NodeRequire = (id: string) => {
      const filename = _require.resolve(id)
      if (isNodeBuiltin(filename))
        return _require(filename)
      const code = readFileSync(filename, 'utf-8')
      return this.evaluateCjsModule(filename, code)
    }
    require.resolve = _require.resolve
    require.extensions = _require.extensions
    require.main = _require.main
    require.cache = this.requireCache
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

  private evaluateJsonCjsModule(filename: string, code: string): Record<string, unknown> {
    const module = this.createCjsModule(filename)
    this.requireCache[filename] = module
    module.exports = JSON.parse(code)
    module.loaded = true
    return module.exports
  }

  // very naive implementation for Node.js require
  private evaluateCjsModule(filename: string, code: string): Record<string, unknown> {
    const cached = this.requireCache[filename]
    if (cached)
      return cached.exports

    if (extname(filename) === '.json')
      return this.evaluateJsonCjsModule(filename, code)

    const cjsModule = `(function (exports, require, module, __filename, __dirname) { ${code} })`
    const script = new vm.Script(cjsModule, {
      filename,
      importModuleDynamically: this.importModuleDynamically as any,
    })
    // @ts-expect-error mark script with current identifier
    script.identifier = filename
    const fn = script.runInContext(this.context)
    const __dirname = dirname(filename)
    const module = this.createCjsModule(filename)
    this.requireCache[filename] = module
    fn(module.exports, module.require, module, filename, __dirname)
    module.loaded = true
    return module.exports
  }

  async evaluateEsmModule(fileUrl: string, code: string) {
    const cached = this.moduleCache.get(fileUrl)
    if (cached)
      return cached
    const m = new vm.SourceTextModule(
      code,
      {
        identifier: fileUrl,
        context: this.context,
        importModuleDynamically: this.importModuleDynamically as any,
        initializeImportMeta: (meta, mod) => {
          meta.url = mod.identifier
          // meta.resolve = (specifier: string, importer?: string) =>
          //   this.resolveAsync(specifier, importer ?? mod.identifier)
        },
      },
    )
    const promise = this.evaluateModule(m)
    this.moduleCache.set(fileUrl, promise)
    return await promise
  }

  async evaluateImport(identifier: string) {
    if (isNodeBuiltin(identifier)) {
      const exports = await import(identifier)
      const module = await this.evaluateModule(this.wrapSynteticModule(identifier, 'builtin', exports))
      return {
        format: 'builtin',
        module,
        exports,
      }
    }

    const isFileUrl = identifier.startsWith('file://')
    const fileUrl = isFileUrl ? identifier : pathToFileURL(identifier).toString()
    const pathUrl = isFileUrl ? fileURLToPath(identifier) : identifier
    const code = await readFile(pathUrl, 'utf-8')

    if (identifier.endsWith('.cjs') || !hasESMSyntax(code)) {
      const exports = this.evaluateCjsModule(pathUrl, code)
      const module = await this.evaluateModule(this.wrapSynteticModule(fileUrl, 'cjs', exports))
      return {
        format: 'cjs',
        module,
        exports,
      }
    }

    const module = await this.evaluateEsmModule(fileUrl, code)

    return {
      format: 'esm',
      module,
      exports: module.namespace,
    }
  }

  async import(identifier: string) {
    const { exports } = await this.evaluateImport(identifier)
    return exports
  }
}

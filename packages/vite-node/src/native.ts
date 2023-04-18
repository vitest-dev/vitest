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
  private moduleCache = new Map<string, vm.Module>()

  constructor(context: vm.Context) {
    this.context = context
  }

  importModuleDynamically = async (specifier: string, script: vm.Module) => {
    const identifier = await this.resolveAsync(specifier, script.identifier)
    return await this.createModule(identifier)
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

  async evaluateModule<T extends vm.Module>(m: T): Promise<T> {
    if (m.status === 'unlinked')
      await m.link(this.importModuleDynamically)

    if (m.status === 'linked')
      await m.evaluate()

    return m
  }

  private createCjsNodeModule(filename: string) {
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
    const module = this.createCjsNodeModule(filename)
    this.requireCache[filename] = module
    module.exports = JSON.parse(code)
    module.loaded = true
    return module.exports
  }

  // very naive implementation for Node.js require
  private evaluateCjsModule(filename: string, code: string): Record<string, unknown> {
    // console.log('cjs', filename)
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
    const module = this.createCjsNodeModule(filename)
    this.requireCache[filename] = module
    fn(module.exports, module.require, module, filename, __dirname)
    module.loaded = true
    return module.exports
  }

  async createEsmModule(fileUrl: string, code: string) {
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
    this.moduleCache.set(fileUrl, m)
    return m
  }

  async createModule(identifier: string): Promise<vm.Module> {
    if (isNodeBuiltin(identifier)) {
      const exports = await import(identifier)
      return await this.wrapSynteticModule(identifier, 'builtin', exports)
    }

    const isFileUrl = identifier.startsWith('file://')
    const fileUrl = isFileUrl ? identifier : pathToFileURL(identifier).toString()
    const pathUrl = isFileUrl ? fileURLToPath(identifier) : identifier
    const code = await readFile(pathUrl, 'utf-8')

    if (identifier.endsWith('.cjs') || !hasESMSyntax(code)) {
      const exports = this.evaluateCjsModule(pathUrl, code)
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

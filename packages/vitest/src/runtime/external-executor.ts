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

const _require = createRequire(import.meta.url)

export class ExternalModulesExecutor {
  private context: vm.Context

  private requireCache = _require.cache
  private moduleCache = new Map<string, vm.Module>()

  private esmLinkMap = new WeakMap<vm.Module, Promise<void>>()

  constructor(context: vm.Context) {
    this.context = context
    for (const file in this.requireCache)
      delete this.requireCache[file]
  }

  importModuleDynamically = async (specifier: string, referencer: vm.Module) => {
    const module = await this.resolveModule(specifier, referencer)
    return this.evaluateModule(module)
  }

  resolveModule = async (specifier: string, referencer: vm.Module) => {
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
    const m: any = new vm.SyntheticModule(
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

  async evaluateModule<T extends vm.Module>(m: T): Promise<T> {
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

  private createCommonJSNodeModule(filename: string) {
    const _require = createRequire(filename)
    // TODO: doesn't respect "extensions"
    const require: NodeRequire = (id: string) => {
      const filename = _require.resolve(id)
      if (isNodeBuiltin(filename))
        return _require(filename)
      const code = readFileSync(filename, 'utf-8')
      return this.evaluateCommonJSModule(filename, code)
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

  private evaluateJsonCommonJSModule(filename: string, code: string): Record<string, unknown> {
    const module = this.createCommonJSNodeModule(filename)
    this.requireCache[filename] = module
    module.exports = JSON.parse(code)
    module.loaded = true
    return module.exports
  }

  private evaluateCssCommonJSModule(filename: string): Record<string, unknown> {
    const module = this.createCommonJSNodeModule(filename)
    this.requireCache[filename] = module
    module.loaded = true
    return module.exports
  }

  // very naive implementation for Node.js require
  private evaluateCommonJSModule(filename: string, code: string): Record<string, unknown> {
    const cached = this.requireCache[filename]
    if (cached)
      return cached.exports

    const extension = extname(filename)

    if (extension === '.json')
      return this.evaluateJsonCommonJSModule(filename, code)
    // TODO: should respect "extensions"
    if (extension === '.css' || extension === '.scss' || extension === '.sass')
      return this.evaluateCssCommonJSModule(filename)

    const cjsModule = `(function (exports, require, module, __filename, __dirname) { ${code}\n})`
    const script = new vm.Script(cjsModule, {
      filename,
      importModuleDynamically: this.importModuleDynamically as any,
    })
    // @ts-expect-error mark script with current identifier
    script.identifier = filename
    const fn = script.runInContext(this.context)
    const __dirname = dirname(filename)
    const module = this.createCommonJSNodeModule(filename)
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

  // TODO: return custom "createRequire" function for "node:module"
  private requireCoreModule(identifier: string) {
    return _require(identifier)
  }

  private getIdentifierCode(code: string) {
    if (code.startsWith('data:text/javascript'))
      return code.match(/data:text\/javascript;.*,(.*)/)?.[1]
  }

  async createModule(identifier: string): Promise<vm.Module> {
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

    // TODO: very dirty check for cjs, it should actually check filepath
    if (!inlineCode && (extension === '.cjs' || !hasESMSyntax(code))) {
      const exports = this.evaluateCommonJSModule(pathUrl, code)
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

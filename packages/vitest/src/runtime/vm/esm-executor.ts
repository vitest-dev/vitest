/* eslint-disable antfu/no-cjs-exports */

import vm from 'node:vm'
import { CSS_LANGS_RE, KNOWN_ASSET_RE } from 'vite-node/constants'
import { extname, normalize } from 'pathe'
import { getColors } from '@vitest/utils'
import type { ExternalModulesExecutor } from '../external-executor'
import type { VMModule, VMSourceTextModule, VMSyntheticModule } from './types'

interface EsmExecutorOptions {
  context: vm.Context
}

const SyntheticModule: typeof VMSyntheticModule = (vm as any).SyntheticModule
const SourceTextModule: typeof VMSourceTextModule = (vm as any).SourceTextModule

const dataURIRegex
  = /^data:(?<mime>text\/javascript|application\/json|application\/wasm)(?:;(?<encoding>charset=utf-8|base64))?,(?<code>.*)$/

export class EsmExecutor {
  private moduleCache = new Map<string, VMModule | Promise<VMModule>>()

  private esmLinkMap = new WeakMap<VMModule, Promise<void>>()
  private context: vm.Context

  constructor(private executor: ExternalModulesExecutor, options: EsmExecutorOptions) {
    this.context = options.context
  }

  public async evaluateModule<T extends VMModule>(m: T): Promise<T> {
    if (m.status === 'unlinked') {
      this.esmLinkMap.set(
        m,
        m.link((identifier, referencer) =>
          this.executor.resolveModule(identifier, referencer.identifier),
        ),
      )
    }

    await this.esmLinkMap.get(m)

    if (m.status === 'linked')
      await m.evaluate()

    return m
  }

  public async createEsmModule(fileUrl: string, code: string) {
    const cached = this.moduleCache.get(fileUrl)
    if (cached)
      return cached
    const [urlPath] = fileUrl.split('?')
    if (CSS_LANGS_RE.test(urlPath) || KNOWN_ASSET_RE.test(urlPath)) {
      const path = normalize(urlPath)
      let name = path.split('/node_modules/').pop() || ''
      if (name?.startsWith('@'))
        name = name.split('/').slice(0, 2).join('/')
      else
        name = name.split('/')[0]
      const ext = extname(path)
      let error = `[vitest] Cannot import ${fileUrl}. At the moment, importing ${ext} files inside external dependencies is not allowed. `
      if (name) {
        const c = getColors()
        error += 'As a temporary workaround you can try to inline the package by updating your config:'
+ `\n\n${
c.gray(c.dim('// vitest.config.js'))
}\n${
c.green(`export default {
  test: {
    deps: {
      optimizer: {
        web: {
          include: [
            ${c.yellow(c.bold(`"${name}"`))}
          ]
        }
      }
    }
  }
}\n`)}`
      }
      throw new Error(error)
    }
    // TODO: should not be allowed in strict mode, implement in #2854
    if (fileUrl.endsWith('.json')) {
      const m = new SyntheticModule(
        ['default'],
        () => {
          const result = JSON.parse(code)
          m.setExport('default', result)
        },
      )
      this.moduleCache.set(fileUrl, m)
      return m
    }
    const m = new SourceTextModule(
      code,
      {
        identifier: fileUrl,
        context: this.context,
        importModuleDynamically: this.executor.importModuleDynamically,
        initializeImportMeta: (meta, mod) => {
          meta.url = mod.identifier
          meta.resolve = (specifier: string, importer?: string) => {
            return this.executor.resolveId(specifier, importer ?? mod.identifier)
          }
        },
      },
    )
    this.moduleCache.set(fileUrl, m)
    return m
  }

  public async loadWebAssemblyModule(source: Buffer, identifier: string) {
    const cached = this.moduleCache.get(identifier)
    if (cached)
      return cached

    const wasmModule = await WebAssembly.compile(source)

    const exports = WebAssembly.Module.exports(wasmModule)
    const imports = WebAssembly.Module.imports(wasmModule)

    const moduleLookup: Record<string, VMModule> = {}
    for (const { module } of imports) {
      if (moduleLookup[module] === undefined) {
        const resolvedModule = await this.executor.resolveModule(
          module,
          identifier,
        )

        moduleLookup[module] = await this.evaluateModule(resolvedModule)
      }
    }

    const syntheticModule = new SyntheticModule(
      exports.map(({ name }) => name),
      () => {
        const importsObject: WebAssembly.Imports = {}
        for (const { module, name } of imports) {
          if (!importsObject[module])
            importsObject[module] = {}

          importsObject[module][name] = (moduleLookup[module].namespace as any)[name]
        }
        const wasmInstance = new WebAssembly.Instance(
          wasmModule,
          importsObject,
        )
        for (const { name } of exports)
          syntheticModule.setExport(name, wasmInstance.exports[name])
      },
      { context: this.context, identifier },
    )

    return syntheticModule
  }

  public async createDataModule(identifier: string): Promise<VMModule> {
    const cached = this.moduleCache.get(identifier)
    if (cached)
      return cached

    const match = identifier.match(dataURIRegex)

    if (!match || !match.groups)
      throw new Error('Invalid data URI')

    const mime = match.groups.mime
    const encoding = match.groups.encoding

    if (mime === 'application/wasm') {
      if (!encoding)
        throw new Error('Missing data URI encoding')

      if (encoding !== 'base64')
        throw new Error(`Invalid data URI encoding: ${encoding}`)

      const module = await this.loadWebAssemblyModule(
        Buffer.from(match.groups.code, 'base64'),
        identifier,
      )
      this.moduleCache.set(identifier, module)
      return module
    }

    let code = match.groups.code
    if (!encoding || encoding === 'charset=utf-8')
      code = decodeURIComponent(code)

    else if (encoding === 'base64')
      code = Buffer.from(code, 'base64').toString()
    else
      throw new Error(`Invalid data URI encoding: ${encoding}`)

    if (mime === 'application/json') {
      const module = new SyntheticModule(
        ['default'],
        () => {
          const obj = JSON.parse(code)
          module.setExport('default', obj)
        },
        { context: this.context, identifier },
      )
      this.moduleCache.set(identifier, module)
      return module
    }

    return this.createEsmModule(identifier, code)
  }
}

import type vm from 'node:vm'
import type { ExternalModulesExecutor } from '../external-executor'
import type { VMModule } from './types'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SourceTextModule, SyntheticModule } from './utils'

interface EsmExecutorOptions {
  context: vm.Context
}

const dataURIRegex
  = /^data:(?<mime>text\/javascript|application\/json|application\/wasm)(?:;(?<encoding>charset=utf-8|base64))?,(?<code>.*)$/

export class EsmExecutor {
  private moduleCache = new Map<string, VMModule | Promise<VMModule>>()

  private esmLinkMap = new WeakMap<VMModule, Promise<void>>()
  private context: vm.Context

  #httpIp = IPnumber('127.0.0.0')

  constructor(
    private executor: ExternalModulesExecutor,
    options: EsmExecutorOptions,
  ) {
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

    if (m.status === 'linked') {
      await m.evaluate()
    }

    return m
  }

  public async createEsModule(
    fileURL: string,
    getCode: () => Promise<string> | string,
  ) {
    const cached = this.moduleCache.get(fileURL)
    if (cached) {
      return cached
    }
    const promise = this.loadEsModule(fileURL, getCode)
    this.moduleCache.set(fileURL, promise)
    return promise
  }

  private async loadEsModule(
    fileURL: string,
    getCode: () => string | Promise<string>,
  ) {
    const code = await getCode()
    // TODO: should not be allowed in strict mode, implement in #2854
    if (fileURL.endsWith('.json')) {
      const m = new SyntheticModule(['default'], () => {
        const result = JSON.parse(code)
        m.setExport('default', result)
      })
      this.moduleCache.set(fileURL, m)
      return m
    }
    const m = new SourceTextModule(code, {
      identifier: fileURL,
      context: this.context,
      importModuleDynamically: this.executor.importModuleDynamically,
      initializeImportMeta: (meta, mod) => {
        meta.url = mod.identifier
        if (mod.identifier.startsWith('file:')) {
          const filename = fileURLToPath(mod.identifier)
          meta.filename = filename
          meta.dirname = dirname(filename)
        }
        meta.resolve = (specifier: string, importer?: string | URL) => {
          return this.executor.resolve(
            specifier,
            importer != null ? importer.toString() : mod.identifier,
          )
        }
      },
    })
    this.moduleCache.set(fileURL, m)
    return m
  }

  public async createWebAssemblyModule(fileUrl: string, getCode: () => Buffer) {
    const cached = this.moduleCache.get(fileUrl)
    if (cached) {
      return cached
    }
    const m = this.loadWebAssemblyModule(getCode(), fileUrl)
    this.moduleCache.set(fileUrl, m)
    return m
  }

  public async createNetworkModule(fileUrl: string) {
    // https://nodejs.org/api/esm.html#https-and-http-imports
    if (fileUrl.startsWith('http:')) {
      const url = new URL(fileUrl)
      if (
        url.hostname !== 'localhost'
        && url.hostname !== '::1'
        && (IPnumber(url.hostname) & IPmask(8)) !== this.#httpIp
      ) {
        throw new Error(
          // we don't know the importer, so it's undefined (the same happens in --pool=threads)
          `import of '${fileUrl}' by undefined is not supported: `
          + 'http can only be used to load local resources (use https instead).',
        )
      }
    }

    return this.createEsModule(fileUrl, () =>
      fetch(fileUrl).then(r => r.text()))
  }

  public async loadWebAssemblyModule(source: Buffer, identifier: string) {
    const cached = this.moduleCache.get(identifier)
    if (cached) {
      return cached
    }

    const wasmModule = await WebAssembly.compile(source)

    const exports = WebAssembly.Module.exports(wasmModule)
    const imports = WebAssembly.Module.imports(wasmModule)

    const moduleLookup: Record<string, VMModule> = {}
    for (const { module } of imports) {
      if (moduleLookup[module] === undefined) {
        moduleLookup[module] = await this.executor.resolveModule(
          module,
          identifier,
        )
      }
    }

    const syntheticModule = new SyntheticModule(
      exports.map(({ name }) => name),
      async () => {
        const importsObject: WebAssembly.Imports = {}
        for (const { module, name } of imports) {
          if (!importsObject[module]) {
            importsObject[module] = {}
          }
          await this.evaluateModule(moduleLookup[module])
          importsObject[module][name] = (moduleLookup[module].namespace as any)[
            name
          ]
        }
        const wasmInstance = new WebAssembly.Instance(
          wasmModule,
          importsObject,
        )
        for (const { name } of exports) {
          syntheticModule.setExport(name, wasmInstance.exports[name])
        }
      },
      { context: this.context, identifier },
    )

    return syntheticModule
  }

  public cacheModule(identifier: string, module: VMModule) {
    this.moduleCache.set(identifier, module)
  }

  public resolveCachedModule(identifier: string) {
    return this.moduleCache.get(identifier)
  }

  public async createDataModule(identifier: string): Promise<VMModule> {
    const cached = this.moduleCache.get(identifier)
    if (cached) {
      return cached
    }

    const match = identifier.match(dataURIRegex)

    if (!match || !match.groups) {
      throw new Error('Invalid data URI')
    }

    const mime = match.groups.mime
    const encoding = match.groups.encoding

    if (mime === 'application/wasm') {
      if (!encoding) {
        throw new Error('Missing data URI encoding')
      }

      if (encoding !== 'base64') {
        throw new Error(`Invalid data URI encoding: ${encoding}`)
      }

      const module = this.loadWebAssemblyModule(
        Buffer.from(match.groups.code, 'base64'),
        identifier,
      )
      this.moduleCache.set(identifier, module)
      return module
    }

    let code = match.groups.code
    if (!encoding || encoding === 'charset=utf-8') {
      code = decodeURIComponent(code)
    }
    else if (encoding === 'base64') {
      code = Buffer.from(code, 'base64').toString()
    }
    else {
      throw new Error(`Invalid data URI encoding: ${encoding}`)
    }

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

    return this.createEsModule(identifier, () => code)
  }
}

function IPnumber(address: string) {
  const ip = address.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (ip) {
    return (+ip[1] << 24) + (+ip[2] << 16) + (+ip[3] << 8) + +ip[4]
  }

  throw new Error(`Expected IP address, received ${address}`)
}

function IPmask(maskSize: number) {
  return -1 << (32 - maskSize)
}

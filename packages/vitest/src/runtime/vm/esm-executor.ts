import type vm from 'node:vm'
import type { ExternalModulesExecutor, SyncModuleDisposition } from '../external-executor'
import type { SourceTextModuleOptions, VMModule, VMSourceTextModule, VMSyntheticModule } from './types'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { VITEST_VM_CONTEXT_SYMBOL } from '../moduleRunner/startVitestModuleRunner'
import {
  createConcurrentRequireError,
  createRequireAsyncModuleError,
  SourceTextModule,
  SyntheticModule,
} from './utils'

interface EsmExecutorOptions {
  context: vm.Context
}

// One entry per module collected by the require(esm) graph walker. `deps`
// (dependency identifiers, one per module request) discriminates source-text
// modules built by the walk from complete modules (cache hits, synthetic
// modules); `commit` marks modules the walk owns and should commit to the
// cache — false for cache hits and modules owned by the CJS executor.
type ScratchEntry
  = | { module: VMModule; deps?: undefined; commit: boolean }
    | { module: VMSourceTextModule; deps: string[]; commit: true }

// `hasAsyncGraph` only exists on SourceTextModule — a SyntheticModule is
// synchronous by definition (its evaluation callback is sync)
function moduleHasAsyncGraph(module: VMModule): boolean {
  return module instanceof SourceTextModule && module.hasAsyncGraph()
}

const dataURIRegex
  = /^data:(?<mime>text\/javascript|application\/json|application\/wasm)(?:;(?<encoding>charset=utf-8|base64))?,(?<code>.*)$/

function parseDataUri(identifier: string): { mime: string; code: string | Buffer } {
  const match = identifier.match(dataURIRegex)
  if (!match || !match.groups) {
    throw new Error('Invalid data URI')
  }
  const { mime, encoding } = match.groups
  let code: string | Buffer = match.groups.code
  if (mime === 'application/wasm') {
    if (!encoding) {
      throw new Error('Missing data URI encoding')
    }
    if (encoding !== 'base64') {
      throw new Error(`Invalid data URI encoding: ${encoding}`)
    }
    return { mime, code: Buffer.from(code, 'base64') }
  }
  if (!encoding || encoding === 'charset=utf-8') {
    code = decodeURIComponent(code)
  }
  else if (encoding === 'base64') {
    code = Buffer.from(code, 'base64').toString()
  }
  else {
    throw new Error(`Invalid data URI encoding: ${encoding}`)
  }
  return { mime, code }
}

function getContextExecutor(mod: VMModule): ExternalModulesExecutor {
  const vmContext = (mod.context as any)?.[VITEST_VM_CONTEXT_SYMBOL]
  if (!vmContext) {
    throw new Error(`Cannot import "${mod.identifier}": its vm context was torn down.`)
  }
  return vmContext.externalModulesExecutor
}

async function staticImportModuleDynamically(specifier: string, referencer: VMModule): Promise<VMModule> {
  return getContextExecutor(referencer).importModuleDynamically(specifier, referencer)
}

function staticInitializeImportMeta(meta: ImportMeta, mod: VMModule): void {
  meta.url = mod.identifier
  if (mod.identifier.startsWith('file:')) {
    const filename = fileURLToPath(mod.identifier)
    meta.filename = filename
    meta.dirname = dirname(filename)
  }
  meta.resolve = (specifier: string, importer?: string | URL) => {
    return getContextExecutor(mod).resolve(
      specifier,
      importer != null ? importer.toString() : mod.identifier,
    )
  }
}

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
    // a module that failed to evaluate keeps living in the cache — rethrow
    // its error instead of silently returning an unusable namespace
    if (m.status === 'errored') {
      throw m.error
    }
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
  ): Promise<VMModule> {
    const cached = this.moduleCache.get(fileURL)
    if (cached) {
      return cached
    }
    const promise = this.loadEsModule(fileURL, getCode)
    this.moduleCache.set(fileURL, promise)
    return promise
  }

  private loadEsModule(
    fileURL: string,
    getCode: () => string | Promise<string>,
  ) {
    const code = getCode()
    if (code instanceof Promise) {
      return code.then(content => this.createModule(fileURL, content))
    }
    return this.createModule(fileURL, code)
  }

  private createModule(fileURL: string, code: string): VMSyntheticModule | VMSourceTextModule {
    const module = fileURL.endsWith('.json')
      ? this.createJsonModule(fileURL, code)
      : this.createSourceTextModule(fileURL, code)
    this.moduleCache.set(fileURL, module)
    return module
  }

  private createSourceTextModule(
    fileURL: string,
    code: string,
  ): VMSourceTextModule {
    const codeCache = this.executor.codeCache
    let cachedData = codeCache?.get(fileURL, code)
    const options: SourceTextModuleOptions = {
      identifier: fileURL,
      context: this.context,
      // static callbacks: Node keeps them registered for as long as the
      // module's host-defined-options symbol is alive, so a closure here would
      // retain this executor (and the whole test file's world) beyond the
      // file's lifetime. The executor is recovered from the module's context
      // at call time instead.
      importModuleDynamically: staticImportModuleDynamically,
      initializeImportMeta: staticInitializeImportMeta,
    }
    let m: VMSourceTextModule | undefined
    if (cachedData) {
      try {
        m = new SourceTextModule(code, { ...options, cachedData })
      }
      catch (error: any) {
        // unlike vm.Script, a module throws when V8 rejects the cache (e.g. the
        // V8 flags changed at runtime): compile from source instead
        if (error?.code !== 'ERR_VM_MODULE_CACHED_DATA_REJECTED') {
          throw error
        }
        codeCache!.delete(fileURL)
        cachedData = undefined
      }
    }
    m ??= new SourceTextModule(code, options)
    // the code cache of a SourceTextModule must be created before evaluation
    if (!cachedData) {
      const created = m
      codeCache?.store(fileURL, code, () => created.createCachedData())
    }
    return m
  }

  // Loads an ES module graph synchronously for require(esm), mirroring Node's
  // own behaviour on Node 24.9+. The graph is collected into a local scratch
  // map first and committed to the module cache only after the whole graph is
  // proven to be synchronously evaluable, so a failed require() does not
  // poison the cache for a later import() of the same file.
  public requireEsModuleSync(rootIdentifier: string): VMModule {
    const cachedRoot = this.moduleCache.get(rootIdentifier)
    if (cachedRoot) {
      return this.reuseSyncModule(rootIdentifier, cachedRoot)
    }

    const scratch = new Map<string, ScratchEntry>()
    const worklist: string[] = [rootIdentifier]

    while (worklist.length > 0) {
      const identifier = worklist.pop()!
      if (scratch.has(identifier)) {
        continue
      }

      const cached = this.moduleCache.get(identifier)
      if (cached) {
        scratch.set(identifier, {
          module: this.reuseSyncModule(identifier, cached),
          commit: false,
        })
        continue
      }

      const disposition = identifier.startsWith('data:')
        ? this.materializeSyncDataModule(identifier)
        : this.executor.materializeSyncModule(
            identifier,
            identifier === rootIdentifier,
          )

      if (disposition.kind === 'ready') {
        scratch.set(identifier, { module: disposition.module, commit: false })
        continue
      }

      if (disposition.kind === 'json') {
        scratch.set(identifier, {
          module: this.createJsonModule(identifier, disposition.code),
          commit: true,
        })
        continue
      }

      const module = this.createSourceTextModule(identifier, disposition.code)
      if (module.hasTopLevelAwait()) {
        throw createRequireAsyncModuleError(
          identifier,
          'the module uses top-level await',
        )
      }
      const deps: string[] = []
      for (const request of module.moduleRequests) {
        const depIdentifier = this.executor.resolveSyncSpecifier(
          request.specifier,
          identifier,
        )
        deps.push(depIdentifier)
        if (!scratch.has(depIdentifier)) {
          worklist.push(depIdentifier)
        }
      }
      scratch.set(identifier, { module, deps, commit: true })
    }

    for (const entry of scratch.values()) {
      if (entry.deps) {
        entry.module.linkRequests(
          entry.deps.map(dep => scratch.get(dep)!.module),
        )
      }
    }

    const root = scratch.get(rootIdentifier)!
    if (root.deps) {
      root.module.instantiate()
    }

    if (moduleHasAsyncGraph(root.module)) {
      // top-level await is rejected per module during the walk, so this is a
      // defensive check that an async graph never reaches the sync evaluate
      let culprit = rootIdentifier
      for (const [identifier, entry] of scratch) {
        if (entry.deps && entry.module.hasTopLevelAwait()) {
          culprit = identifier
          break
        }
      }
      throw createRequireAsyncModuleError(
        rootIdentifier,
        culprit === rootIdentifier
          ? 'the module uses top-level await'
          : `its dependency uses top-level await (${culprit})`,
      )
    }

    for (const [identifier, entry] of scratch) {
      if (entry.commit && !this.moduleCache.has(identifier)) {
        this.moduleCache.set(identifier, entry.module)
      }
    }

    // with no top-level await in the graph, evaluate() fulfills synchronously
    // and an evaluation error lands on `status`/`error`, not on the promise
    root.module.evaluate().catch(() => {})

    if (root.module.status === 'errored') {
      throw root.module.error
    }
    if (root.module.status !== 'evaluated') {
      throw new Error(
        `[vitest] Expected synchronous evaluation to complete for ${rootIdentifier}, but module status is "${root.module.status}". This is a bug in Vitest.`,
      )
    }
    return root.module
  }

  // A cached module is reusable by the sync walker only when it is settled:
  // anything else (a pending Promise or a module in 'unlinked' → 'evaluating')
  // is a concurrent import() mid-flight that a synchronous require() can
  // neither await nor safely link against.
  private reuseSyncModule(
    identifier: string,
    cached: VMModule | Promise<VMModule>,
  ): VMModule {
    if (cached instanceof Promise) {
      throw createConcurrentRequireError(identifier)
    }
    if (cached.status === 'errored') {
      throw cached.error
    }
    if (cached.status !== 'evaluated') {
      throw createConcurrentRequireError(identifier)
    }
    // a module with top-level await reports 'evaluated' as soon as evaluate()
    // is called, while its async evaluation may still be pending — and even a
    // settled async graph is never allowed in require() (Node parity)
    if (moduleHasAsyncGraph(cached)) {
      throw createRequireAsyncModuleError(
        identifier,
        'the module uses top-level await',
      )
    }
    return cached
  }

  private materializeSyncDataModule(identifier: string): SyncModuleDisposition {
    const { mime, code } = parseDataUri(identifier)
    if (mime === 'application/wasm') {
      throw createRequireAsyncModuleError(
        identifier,
        'WebAssembly modules cannot be loaded synchronously',
      )
    }
    if (mime === 'application/json') {
      return { kind: 'json', code: code as string }
    }
    return { kind: 'source', code: code as string }
  }

  private createJsonModule(identifier: string, code: string): VMSyntheticModule {
    return new SyntheticModule(
      ['default'],
      function (this: VMSyntheticModule) {
        this.setExport('default', JSON.parse(code))
      },
      { context: this.context, identifier },
    )
  }

  public async createWebAssemblyModule(fileUrl: string, getCode: () => Buffer<ArrayBuffer>): Promise<VMModule> {
    const cached = this.moduleCache.get(fileUrl)
    if (cached) {
      return cached
    }
    const m = this.loadWebAssemblyModule(getCode(), fileUrl)
    this.moduleCache.set(fileUrl, m)
    return m
  }

  public async createNetworkModule(fileUrl: string): Promise<VMModule> {
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

  public async loadWebAssemblyModule(source: Buffer<ArrayBuffer>, identifier: string): Promise<VMModule> {
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

    const evaluateModule = (module: VMModule) => this.evaluateModule(module)

    const syntheticModule = new SyntheticModule(
      exports.map(({ name }) => name),
      async function () {
        const importsObject: WebAssembly.Imports = {}
        for (const { module, name } of imports) {
          if (!importsObject[module]) {
            importsObject[module] = {}
          }
          await evaluateModule(moduleLookup[module])
          importsObject[module][name] = (moduleLookup[module].namespace as any)[
            name
          ]
        }
        const wasmInstance = new WebAssembly.Instance(
          wasmModule,
          importsObject,
        )
        for (const { name } of exports) {
          this.setExport(name, wasmInstance.exports[name])
        }
      },
      { context: this.context, identifier },
    )

    return syntheticModule
  }

  public cacheModule(identifier: string, module: VMModule): void {
    this.moduleCache.set(identifier, module)
  }

  public resolveCachedModule(identifier: string): VMModule | Promise<VMModule> | undefined {
    return this.moduleCache.get(identifier)
  }

  public async createDataModule(identifier: string): Promise<VMModule> {
    const cached = this.moduleCache.get(identifier)
    if (cached) {
      return cached
    }

    const { mime, code } = parseDataUri(identifier)

    if (mime === 'application/wasm') {
      const module = this.loadWebAssemblyModule(
        code as Buffer<ArrayBuffer>,
        identifier,
      )
      this.moduleCache.set(identifier, module)
      return module
    }

    if (mime === 'application/json') {
      const module = this.createJsonModule(identifier, code as string)
      this.moduleCache.set(identifier, module)
      return module
    }

    return this.createEsModule(identifier, () => code as string)
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

import { performance } from 'node:perf_hooks'
import { existsSync } from 'node:fs'
import assert from 'node:assert'
import { join, normalize, relative, resolve } from 'pathe'
import type { TransformResult, ViteDevServer } from 'vite'
import createDebug from 'debug'
import type { DebuggerOptions, EncodedSourceMap, FetchResult, ViteNodeResolveId, ViteNodeServerOptions } from './types'
import { shouldExternalize } from './externalize'
import { normalizeModuleId, toArray, toFilePath, withTrailingSlash } from './utils'
import { Debugger } from './debug'
import { withInlineSourcemap } from './source-map'

export * from './externalize'

interface FetchCache {
  duration?: number
  timestamp: number
  result: FetchResult
}

const debugRequest = createDebug('vite-node:server:request')

export class ViteNodeServer {
  private fetchPromiseMap = {
    ssr: new Map<string, Promise<FetchResult>>(),
    web: new Map<string, Promise<FetchResult>>(),
  }

  private transformPromiseMap = {
    ssr: new Map<string, Promise<TransformResult | null | undefined>>(),
    web: new Map<string, Promise<TransformResult | null | undefined>>(),
  }

  private existingOptimizedDeps = new Set<string>()

  fetchCaches = {
    ssr: new Map<string, FetchCache>(),
    web: new Map<string, FetchCache>(),
  }

  fetchCache = new Map<string, FetchCache>()

  externalizeCache = new Map<string, Promise<string | false>>()

  debugger?: Debugger

  constructor(
    public server: ViteDevServer,
    public options: ViteNodeServerOptions = {},
  ) {
    const ssrOptions = server.config.ssr

    options.deps ??= {}
    options.deps.cacheDir = relative(server.config.root, options.deps.cacheDir || server.config.cacheDir)

    if (ssrOptions) {
      // we don't externalize ssr, because it has different semantics in Vite
      // if (ssrOptions.external) {
      //   options.deps.external ??= []
      //   options.deps.external.push(...ssrOptions.external)
      // }

      if (ssrOptions.noExternal === true) {
        options.deps.inline ??= true
      }
      else if (options.deps.inline !== true) {
        options.deps.inline ??= []
        options.deps.inline.push(...toArray(ssrOptions.noExternal))
      }
    }
    if (process.env.VITE_NODE_DEBUG_DUMP) {
      options.debug = Object.assign(<DebuggerOptions>{
        dumpModules: !!process.env.VITE_NODE_DEBUG_DUMP,
        loadDumppedModules: process.env.VITE_NODE_DEBUG_DUMP === 'load',
      }, options.debug ?? {})
    }
    if (options.debug)
      this.debugger = new Debugger(server.config.root, options.debug!)

    options.deps.moduleDirectories ??= []

    const envValue = process.env.VITE_NODE_DEPS_MODULE_DIRECTORIES || process.env.npm_config_VITE_NODE_DEPS_MODULE_DIRECTORIES
    const customModuleDirectories = envValue?.split(',')
    if (customModuleDirectories)
      options.deps.moduleDirectories.push(...customModuleDirectories)

    options.deps.moduleDirectories = options.deps.moduleDirectories.map((dir) => {
      if (!dir.startsWith('/'))
        dir = `/${dir}`
      if (!dir.endsWith('/'))
        dir += '/'
      return normalize(dir)
    })

    // always add node_modules as a module directory
    if (!options.deps.moduleDirectories.includes('/node_modules/'))
      options.deps.moduleDirectories.push('/node_modules/')
  }

  shouldExternalize(id: string) {
    return shouldExternalize(id, this.options.deps, this.externalizeCache)
  }

  private async ensureExists(id: string): Promise<boolean> {
    if (this.existingOptimizedDeps.has(id))
      return true
    if (existsSync(id)) {
      this.existingOptimizedDeps.add(id)
      return true
    }
    return new Promise<boolean>((resolve) => {
      setTimeout(() => {
        this.ensureExists(id).then(() => {
          resolve(true)
        })
      })
    })
  }

  async resolveId(id: string, importer?: string, transformMode?: 'web' | 'ssr'): Promise<ViteNodeResolveId | null> {
    if (importer && !importer.startsWith(withTrailingSlash(this.server.config.root)))
      importer = resolve(this.server.config.root, importer)
    const mode = transformMode ?? ((importer && this.getTransformMode(importer)) || 'ssr')
    return this.server.pluginContainer.resolveId(id, importer, { ssr: mode === 'ssr' })
  }

  getSourceMap(source: string) {
    const fetchResult = this.fetchCache.get(source)?.result
    if (fetchResult?.map)
      return fetchResult.map
    const ssrTransformResult = this.server.moduleGraph.getModuleById(source)?.ssrTransformResult
    return (ssrTransformResult?.map || null) as unknown as EncodedSourceMap | null
  }

  private assertMode(mode: 'web' | 'ssr') {
    assert(mode === 'web' || mode === 'ssr', `"transformMode" can only be "web" or "ssr", received "${mode}".`)
  }

  async fetchModule(id: string, transformMode?: 'web' | 'ssr'): Promise<FetchResult> {
    const moduleId = normalizeModuleId(id)
    const mode = transformMode || this.getTransformMode(id)
    this.assertMode(mode)
    const promiseMap = this.fetchPromiseMap[mode]
    // reuse transform for concurrent requests
    if (!promiseMap.has(moduleId)) {
      promiseMap.set(moduleId,
        this._fetchModule(moduleId, mode)
          .then((r) => {
            return this.options.sourcemap !== true ? { ...r, map: undefined } : r
          })
          .finally(() => {
            promiseMap.delete(moduleId)
          }),
      )
    }
    return promiseMap.get(moduleId)!
  }

  async transformRequest(id: string, filepath = id, transformMode?: 'web' | 'ssr') {
    const mode = transformMode || this.getTransformMode(id)
    this.assertMode(mode)
    const promiseMap = this.transformPromiseMap[mode]
    // reuse transform for concurrent requests
    if (!promiseMap.has(id)) {
      promiseMap.set(id,
        this._transformRequest(id, filepath, mode)
          .finally(() => {
            promiseMap.delete(id)
          }),
      )
    }
    return promiseMap.get(id)!
  }

  async transformModule(id: string, transformMode?: 'web' | 'ssr') {
    if (transformMode !== 'web')
      throw new Error('`transformModule` only supports `transformMode: "web"`.')

    const normalizedId = normalizeModuleId(id)
    const mod = this.server.moduleGraph.getModuleById(normalizedId)
    const result = mod?.transformResult || await this.server.transformRequest(normalizedId)

    return {
      code: result?.code,
    }
  }

  getTransformMode(id: string) {
    const withoutQuery = id.split('?')[0]

    if (this.options.transformMode?.web?.some(r => withoutQuery.match(r)))
      return 'web'
    if (this.options.transformMode?.ssr?.some(r => withoutQuery.match(r)))
      return 'ssr'

    if (withoutQuery.match(/\.([cm]?[jt]sx?|json)$/))
      return 'ssr'
    return 'web'
  }

  private async _fetchModule(id: string, transformMode: 'web' | 'ssr'): Promise<FetchResult> {
    let result: FetchResult

    const cacheDir = this.options.deps?.cacheDir

    if (cacheDir && id.includes(cacheDir)) {
      if (!id.startsWith(withTrailingSlash(this.server.config.root)))
        id = join(this.server.config.root, id)
      const timeout = setTimeout(() => {
        throw new Error(`ViteNodeServer: ${id} not found. This is a bug, please report it.`)
      }, 5000) // CI can be quite slow
      await this.ensureExists(id)
      clearTimeout(timeout)
    }

    const { path: filePath } = toFilePath(id, this.server.config.root)

    const module = this.server.moduleGraph.getModuleById(id)
    const timestamp = module ? module.lastHMRTimestamp : null
    const cache = this.fetchCaches[transformMode].get(filePath)
    if (timestamp && cache && cache.timestamp >= timestamp)
      return cache.result

    const time = Date.now()
    const externalize = await this.shouldExternalize(filePath)
    let duration: number | undefined
    if (externalize) {
      result = { externalize }
      this.debugger?.recordExternalize(id, externalize)
    }
    else {
      const start = performance.now()
      const r = await this._transformRequest(id, filePath, transformMode)
      duration = performance.now() - start
      result = { code: r?.code, map: r?.map as any }
    }

    const cacheEntry = {
      duration,
      timestamp: time,
      result,
    }

    this.fetchCaches[transformMode].set(filePath, cacheEntry)
    this.fetchCache.set(filePath, cacheEntry)

    return result
  }

  protected async processTransformResult(filepath: string, result: TransformResult) {
    const mod = this.server.moduleGraph.getModuleById(filepath)
    return withInlineSourcemap(result, {
      filepath: mod?.file || filepath,
      root: this.server.config.root,
    })
  }

  private async _transformRequest(id: string, filepath: string, transformMode: 'web' | 'ssr') {
    debugRequest(id)

    let result: TransformResult | null = null

    if (this.options.debug?.loadDumppedModules) {
      result = await this.debugger?.loadDump(id) ?? null
      if (result)
        return result
    }

    if (transformMode === 'web') {
      // for components like Vue, we want to use the client side
      // plugins but then convert the code to be consumed by the server
      result = await this.server.transformRequest(id)
      if (result)
        result = await this.server.ssrTransform(result.code, result.map, id)
    }
    else {
      result = await this.server.transformRequest(id, { ssr: true })
    }

    const sourcemap = this.options.sourcemap ?? 'inline'
    if (sourcemap === 'inline' && result && !id.includes('node_modules'))
      result = await this.processTransformResult(filepath, result)

    if (this.options.debug?.dumpModules)
      await this.debugger?.dumpFile(id, result)

    return result
  }
}

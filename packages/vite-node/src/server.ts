import { performance } from 'perf_hooks'
import { resolve } from 'pathe'
import type { TransformResult, ViteDevServer } from 'vite'
import createDebug from 'debug'
import type { DebuggerOptions, FetchResult, RawSourceMap, ViteNodeResolveId, ViteNodeServerOptions } from './types'
import { shouldExternalize } from './externalize'
import { toArray, toFilePath, withInlineSourcemap } from './utils'
import { Debugger } from './debug'

export * from './externalize'

const debugRequest = createDebug('vite-node:server:request')

// store the original reference to avoid it been mocked
const RealDate = Date

export class ViteNodeServer {
  private fetchPromiseMap = new Map<string, Promise<FetchResult>>()
  private transformPromiseMap = new Map<string, Promise<TransformResult | null | undefined>>()

  fetchCache = new Map<string, {
    duration?: number
    timestamp: number
    result: FetchResult
  }>()

  externalizeCache = new Map<string, Promise<string | false>>()

  debugger?: Debugger

  constructor(
    public server: ViteDevServer,
    public options: ViteNodeServerOptions = {},
  ) {
    // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
    // @ts-ignore ssr is not typed in Vite 2, but defined in Vite 3, so we can't use expect-error
    const ssrOptions = server.config.ssr
    if (ssrOptions) {
      options.deps ??= {}

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
  }

  shouldExternalize(id: string) {
    return shouldExternalize(id, this.options.deps, this.externalizeCache)
  }

  async resolveId(id: string, importer?: string): Promise<ViteNodeResolveId | null> {
    if (importer && !importer.startsWith(this.server.config.root))
      importer = resolve(this.server.config.root, importer)
    const mode = (importer && this.getTransformMode(importer)) || 'ssr'
    return this.server.pluginContainer.resolveId(id, importer, { ssr: mode === 'ssr' })
  }

  getSourceMap(source: string) {
    const fetchResult = this.fetchCache.get(source)?.result
    if (fetchResult?.map)
      return fetchResult.map
    const ssrTransformResult = this.server.moduleGraph.getModuleById(source)?.ssrTransformResult
    return (ssrTransformResult?.map || null) as unknown as RawSourceMap | null
  }

  async fetchModule(id: string): Promise<FetchResult> {
    // reuse transform for concurrent requests
    if (!this.fetchPromiseMap.has(id)) {
      this.fetchPromiseMap.set(id,
        this._fetchModule(id)
          .then((r) => {
            return this.options.sourcemap !== true ? { ...r, map: undefined } : r
          })
          .finally(() => {
            this.fetchPromiseMap.delete(id)
          }),
      )
    }
    return this.fetchPromiseMap.get(id)!
  }

  async transformRequest(id: string) {
    // reuse transform for concurrent requests
    if (!this.transformPromiseMap.has(id)) {
      this.transformPromiseMap.set(id,
        this._transformRequest(id)
          .finally(() => {
            this.transformPromiseMap.delete(id)
          }),
      )
    }
    return this.transformPromiseMap.get(id)!
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

  private async _fetchModule(id: string): Promise<FetchResult> {
    let result: FetchResult

    const filePath = toFilePath(id, this.server.config.root)

    const module = this.server.moduleGraph.getModuleById(id)
    const timestamp = module?.lastHMRTimestamp || RealDate.now()
    const cache = this.fetchCache.get(filePath)
    if (timestamp && cache && cache.timestamp >= timestamp)
      return cache.result

    const externalize = await this.shouldExternalize(filePath)
    let duration: number | undefined
    if (externalize) {
      result = { externalize }
      this.debugger?.recordExternalize(id, externalize)
    }
    else {
      const start = performance.now()
      const r = await this._transformRequest(id)
      duration = performance.now() - start
      result = { code: r?.code, map: r?.map as unknown as RawSourceMap }
    }

    this.fetchCache.set(filePath, {
      duration,
      timestamp,
      result,
    })

    return result
  }

  private async _transformRequest(id: string) {
    debugRequest(id)

    let result: TransformResult | null = null

    if (this.options.debug?.loadDumppedModules) {
      result = await this.debugger?.loadDump(id) ?? null
      if (result)
        return result
    }

    if (this.getTransformMode(id) === 'web') {
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
      withInlineSourcemap(result)

    if (this.options.debug?.dumpModules)
      await this.debugger?.dumpFile(id, result)

    return result
  }
}

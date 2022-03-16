import { join } from 'pathe'
import type { TransformResult, ViteDevServer } from 'vite'
import type { FetchResult, RawSourceMap, ViteNodeResolveId, ViteNodeServerOptions } from './types'
import { shouldExternalize } from './externalize'
import { toFilePath, withInlineSourcemap } from './utils'

export * from './externalize'

export class ViteNodeServer {
  private fetchPromiseMap = new Map<string, Promise<FetchResult>>()
  private transformPromiseMap = new Map<string, Promise<TransformResult | null | undefined>>()

  fetchCache = new Map<string, {
    timestamp: number
    result: FetchResult
  }>()

  constructor(
    public server: ViteDevServer,
    public options: ViteNodeServerOptions = {},
  ) {}

  shouldExternalize(id: string) {
    return shouldExternalize(id, this.options.deps)
  }

  async resolveId(id: string, importer?: string): Promise<ViteNodeResolveId | null> {
    if (importer && !importer.startsWith(this.server.config.root))
      importer = join(this.server.config.root, importer)
    return this.server.pluginContainer.resolveId(id, importer, { ssr: true })
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
    const timestamp = module?.lastHMRTimestamp || Date.now()
    const cache = this.fetchCache.get(filePath)
    if (timestamp && cache && cache.timestamp >= timestamp)
      return cache.result

    const externalize = await this.shouldExternalize(filePath)
    if (externalize) {
      result = { externalize }
    }
    else {
      const r = await this._transformRequest(id)
      result = { code: r?.code, map: r?.map as unknown as RawSourceMap }
    }

    this.fetchCache.set(filePath, {
      timestamp,
      result,
    })

    return result
  }

  private async _transformRequest(id: string) {
    let result: TransformResult | null = null

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

    return result
  }
}

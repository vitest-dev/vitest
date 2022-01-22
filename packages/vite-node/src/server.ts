import type { TransformResult, ViteDevServer } from 'vite'
import type { FetchResult } from '..'
import { shouldExternalize } from './externalize'
import type { ViteNodeResolveId, ViteNodeServerOptions } from './types'
import { toFilePath, withInlineSourcemap } from './utils'

export * from './externalize'

export class ViteNodeServer {
  private fetchPromiseMap = new Map<string, Promise<FetchResult>>()
  private transformPromiseMap = new Map<string, Promise<TransformResult | null | undefined>>()
  private fetchCache = new Map<string, {
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
    return this.server.pluginContainer.resolveId(id, importer, { ssr: true })
  }

  async fetchModule(id: string): Promise<FetchResult> {
    // reuse transform for concurrent requests
    if (!this.fetchPromiseMap.has(id)) {
      this.fetchPromiseMap.set(id,
        this._fetchModule(id)
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

    const timestamp = this.server.moduleGraph.getModuleById(id)?.lastHMRTimestamp
    const cache = this.fetchCache.get(id)
    if (timestamp && cache && cache.timestamp >= timestamp)
      return cache.result

    const externalize = await this.shouldExternalize(toFilePath(id, this.server.config.root))
    if (externalize) {
      result = { externalize }
    }
    else {
      const r = await this._transformRequest(id)
      result = { code: r?.code }
    }

    if (timestamp) {
      this.fetchCache.set(id, {
        timestamp,
        result,
      })
    }

    return result
  }

  private async _transformRequest(id: string) {
    let result: TransformResult | null = null

    if (this.getTransformMode(id) === 'web') {
      // for components like Vue, we want to use the client side
      // plugins but then covert the code to be consumed by the server
      result = await this.server.transformRequest(id)
      if (result)
        result = await this.server.ssrTransform(result.code, result.map, id)
    }
    else {
      result = await this.server.transformRequest(id, { ssr: true })
    }

    if (this.options.sourcemap !== false && result && !id.includes('node_modules'))
      withInlineSourcemap(result)

    return result
  }
}

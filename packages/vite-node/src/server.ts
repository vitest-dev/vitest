import type { TransformResult, ViteDevServer } from 'vite'
import type { ExternalizeOptions } from './externalize'
import { shouldExternalize } from './externalize'

export * from './externalize'

export interface ViteNodeServerOptions {
  root: string
  deps: ExternalizeOptions
  transformMode: {
    ssr?: RegExp[]
    web?: RegExp[]
  }
}

let SOURCEMAPPING_URL = 'sourceMa'
SOURCEMAPPING_URL += 'ppingURL'

export class ViteNodeServer {
  promiseMap = new Map<string, Promise<TransformResult | null | undefined>>()

  constructor(
    public server: ViteDevServer,
    public options: ViteNodeServerOptions,
  ) {}

  shouldExternalize(id: string) {
    return shouldExternalize(id, this.options.deps)
  }

  async transformRequest(id: string) {
  // reuse transform for concurrent requests
    if (!this.promiseMap.has(id)) {
      this.promiseMap.set(id,
        this._transformRequest(id)
          .then((r) => {
            this.promiseMap.delete(id)
            return r
          }),
      )
    }
    return this.promiseMap.get(id)
  }

  private getTransformMode(id: string) {
    const withoutQuery = id.split('?')[0]

    if (this.options.transformMode?.web?.some(r => withoutQuery.match(r)))
      return 'web'
    if (this.options.transformMode?.ssr?.some(r => withoutQuery.match(r)))
      return 'ssr'

    if (withoutQuery.match(/\.([cm]?[jt]sx?|json)$/))
      return 'ssr'
    return 'web'
  }

  private async _transformRequest(id: string) {
    let result: TransformResult | null = null

    const mode = this.getTransformMode(id)
    if (mode === 'web') {
    // for components like Vue, we want to use the client side
    // plugins but then covert the code to be consumed by the server
      result = await this.server.transformRequest(id)
      if (result)
        result = await this.server.ssrTransform(result.code, result.map, id)
    }
    else {
      result = await this.server.transformRequest(id, { ssr: true })
    }

    if (result && !id.includes('node_modules'))
      withInlineSourcemap(result)

    // if (result?.map && process.env.NODE_V8_COVERAGE)
    //   visitedFilesMap.set(toFilePath(id, config.root), result.map as any)

    return result
  }
}

export async function withInlineSourcemap(result: TransformResult) {
  const { code, map } = result

  if (code.includes(`${SOURCEMAPPING_URL}=`))
    return result
  if (map)
    result.code = `${code}\n\n//# ${SOURCEMAPPING_URL}=data:application/json;charset=utf-8;base64,${Buffer.from(JSON.stringify(map), 'utf-8').toString('base64')}\n`

  return result
}

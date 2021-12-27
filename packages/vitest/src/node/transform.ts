import type { TransformResult } from 'vite'
import { toFilePath } from '../utils'
import type { Vitest } from './index'

const promiseMap = new Map<string, Promise<TransformResult | null | undefined>>()

export async function transformRequest(ctx: Vitest, id: string) {
  // reuse transform for concurrent requests
  if (!promiseMap.has(id)) {
    promiseMap.set(id,
      _transformRequest(ctx, id)
        .then((r) => {
          promiseMap.delete(id)
          return r
        }),
    )
  }
  return promiseMap.get(id)
}

async function _transformRequest(ctx: Vitest, id: string) {
  let result: TransformResult | null = null

  if (id.match(/\.(?:[cm]?[jt]sx?|json)$/)) {
    result = await ctx.server.transformRequest(id, { ssr: true })
  }
  else {
    // for components like Vue, we want to use the client side
    // plugins but then covert the code to be consumed by the server
    result = await ctx.server.transformRequest(id)
    if (result)
      result = await ctx.server.ssrTransform(result.code, result.map, id)
  }

  if (result?.map && process.env.NODE_V8_COVERAGE)
    ctx.visitedFilesMap.set(toFilePath(id, ctx.config.root), result.map as any)

  return result
}

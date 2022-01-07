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

function getTransformMode(ctx: Vitest, id: string) {
  const withoutQuery = id.split('?')[0]

  if (ctx.config.transformMode?.web?.some(r => withoutQuery.match(r)))
    return 'web'
  if (ctx.config.transformMode?.ssr?.some(r => withoutQuery.match(r)))
    return 'ssr'

  if (withoutQuery.match(/\.([cm]?[jt]sx?|json)$/))
    return 'ssr'
  return 'web'
}

async function _transformRequest(ctx: Vitest, id: string) {
  let result: TransformResult | null = null

  const mode = getTransformMode(ctx, id)
  if (mode === 'web') {
    // for components like Vue, we want to use the client side
    // plugins but then covert the code to be consumed by the server
    result = await ctx.server.transformRequest(id)
    if (result)
      result = await ctx.server.ssrTransform(result.code, result.map, id)
  }
  else {
    result = await ctx.server.transformRequest(id, { ssr: true })
  }

  if (result && !id.includes('node_modules'))
    withInlineSourcemap(result)

  if (result?.map && process.env.NODE_V8_COVERAGE)
    ctx.visitedFilesMap.set(toFilePath(id, ctx.config.root), result.map as any)

  return result
}

let SOURCEMAPPING_URL = 'sourceMa'
SOURCEMAPPING_URL += 'ppingURL'

export async function withInlineSourcemap(result: TransformResult) {
  const { code, map } = result

  if (code.includes(`${SOURCEMAPPING_URL}=`))
    return result
  if (map)
    result.code = `${code}\n\n//# ${SOURCEMAPPING_URL}=data:application/json;charset=utf-8;base64,${Buffer.from(JSON.stringify(map), 'utf-8').toString('base64')}\n`

  return result
}

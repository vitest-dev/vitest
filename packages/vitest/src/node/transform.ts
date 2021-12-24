import type { TransformResult } from 'vite'
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

  if (result && process.env.NODE_V8_COVERAGE)
    withInlineSourcemap(result)

  return result
}

let SOURCEMAPPING_URL = 'sourceMa'
SOURCEMAPPING_URL += 'ppingURL'

export async function withInlineSourcemap(result: TransformResult) {
  const { code, map } = result

  if (code.includes(`${SOURCEMAPPING_URL}=`))
    return result

  if (map)
    result.code = `${code}\n\n//# ${SOURCEMAPPING_URL}=data:application/json;charset=utf-8;base64,${Buffer.from(JSON.stringify(map), 'utf-8').toString('base64')}`

  return result
}

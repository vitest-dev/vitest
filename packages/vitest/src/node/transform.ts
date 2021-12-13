import type { ViteDevServer } from 'vite'

export async function transformRequest(server: ViteDevServer, id: string) {
  if (id.match(/\.(?:[cm]?[jt]sx?|json)$/)) {
    return await server.transformRequest(id, { ssr: true })
  }
  else {
    // for components like Vue, we want to use the client side
    // plugins but then covert the code to be consumed by the server
    const result = await server.transformRequest(id)
    if (!result)
      return undefined
    return await server.ssrTransform(result.code, result.map, id)
  }
}

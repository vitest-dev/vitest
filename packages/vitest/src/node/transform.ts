import type { ViteDevServer } from 'vite'
import { SUITE_PATH_DELIMITER } from '../plugins/mocks'

export async function transformRequest(server: ViteDevServer, suite: string, id: string) {
  if (id.match(/\.(?:[cm]?[jt]sx?|json)$/)) {
    if (!id.includes('?suite'))
      id += `?suite=${suite.replace(/\//g, SUITE_PATH_DELIMITER)}`

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

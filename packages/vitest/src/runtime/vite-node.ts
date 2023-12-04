import { ViteNodeServer as ViteNodeServerOriginal } from 'vite-node/server'
import { hoistMocks } from '../node/hoistMocks'

export class ViteNodeServer extends ViteNodeServerOriginal {
  async _transformRequest(id: string, filepath: string, transformMode: 'web' | 'ssr') {
    const result = await super._transformRequest(id, filepath, transformMode)
    if (result) {
      const r = await hoistMocks(result.code)
      if (r?.code) {
        result.code = r?.code
        result.map = r?.map
      }
    }

    return result
  }
}

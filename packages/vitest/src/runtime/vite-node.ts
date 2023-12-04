import { ViteNodeServer as ViteNodeServerOriginal } from 'vite-node/server'
import type { SourceMapInput } from '@ampproject/remapping'
import remapping from '@ampproject/remapping'
import type { SourceMap } from 'magic-string'
import { hoistMocks } from '../node/hoistMocks'

export class ViteNodeServer extends ViteNodeServerOriginal {
  async _transformRequest(id: string, filepath: string, transformMode: 'web' | 'ssr') {
    const originalSourcemap = this.options.sourcemap
    this.options.sourcemap = true
    let result = await super._transformRequest(id, filepath, transformMode)
    if (result) {
      const r = await hoistMocks(result.code)
      if (r) {
        result.code = r.code
        result.map = (result.map ? remapping([r.map as SourceMapInput, result.map as SourceMapInput], () => null) : null) as SourceMap
      }
    }
    const sourcemap = originalSourcemap ?? 'inline'
    if (sourcemap === 'inline' && result && !id.includes('node_modules'))
      result = await this.processTransformResult(filepath, result)
    this.options.sourcemap = originalSourcemap

    return result
  }
}

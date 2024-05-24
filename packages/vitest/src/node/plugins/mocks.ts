import type { Plugin, ViteDevServer } from 'vite'
import { hoistMocks } from '../hoistMocks'
import { distDir } from '../../paths'

export function MocksPlugin(): Plugin {
  let server: ViteDevServer
  return {
    name: 'vitest:mocks',
    enforce: 'post',
    configureServer(_server) {
      server = _server
    },
    transform(code, id) {
      if (
        id.includes(server.config.cacheDir)
        || id.includes(distDir)
      )
        return
      return hoistMocks(code, id, this.parse)
    },
  }
}

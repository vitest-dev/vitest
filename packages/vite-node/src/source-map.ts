import { install } from 'source-map-support'
import type { RawSourceMap } from './types'

interface InstallSourceMapSupportOptions {
  getSourceMap: (source: string) => RawSourceMap | null | undefined
}

export function installSourcemapsSupport(options: InstallSourceMapSupportOptions) {
  install({
    environment: 'node',
    handleUncaughtExceptions: false,
    retrieveSourceMap(source) {
      const map = options.getSourceMap(source)
      if (map) {
        return {
          url: source,
          map,
        }
      }
      return null
    },
  })
}

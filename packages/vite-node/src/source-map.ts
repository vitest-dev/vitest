import { install } from 'source-map-support'
import type { TransformResult } from 'vite'
import type { RawSourceMap } from './types'

interface InstallSourceMapSupportOptions {
  getSourceMap: (source: string) => RawSourceMap | null | undefined
}

let SOURCEMAPPING_URL = 'sourceMa'
SOURCEMAPPING_URL += 'ppingURL'

const VITE_NODE_SOURCEMAPPING_URL = `${SOURCEMAPPING_URL}=data:application/json;charset=utf-8;source=vite-node`
const VITE_NODE_SOURCEMAPPING_REGEXP = new RegExp(`//# ${VITE_NODE_SOURCEMAPPING_URL};base64,(.+)`)
const OTHER_SOURCE_MAP_REGEXP = new RegExp(`//# ${SOURCEMAPPING_URL}=data:application/json[^,]+base64,(.+)`)

export async function withInlineSourcemap(result: TransformResult) {
  const { code, map } = result

  if (!map || code.includes(VITE_NODE_SOURCEMAPPING_URL))
    return result

  // to reduce the payload size, we only inline vite node source map, because it's also the only one we use
  if (OTHER_SOURCE_MAP_REGEXP.test(code))
    result.code = code.replace(OTHER_SOURCE_MAP_REGEXP, '')

  result.code = `${code}\n\n//# ${VITE_NODE_SOURCEMAPPING_URL};base64,${Buffer.from(JSON.stringify(map), 'utf-8').toString('base64')}\n`

  return result
}

export function extractSourceMap(code: string): RawSourceMap | null {
  const mapString = code.match(VITE_NODE_SOURCEMAPPING_REGEXP)?.[1]
  if (mapString)
    return JSON.parse(Buffer.from(mapString, 'base64').toString('utf-8'))
  return null
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

import type { TransformResult } from 'vite'
import { basename } from 'pathe'
import type { EncodedSourceMap } from '@jridgewell/trace-mapping'
import { install } from './source-map-handler'
import { toFilePath } from './utils'

interface InstallSourceMapSupportOptions {
  getSourceMap: (source: string) => EncodedSourceMap | null | undefined
}

let SOURCEMAPPING_URL = 'sourceMa'
SOURCEMAPPING_URL += 'ppingURL'

const VITE_NODE_SOURCEMAPPING_SOURCE = '//# sourceMappingSource=vite-node'
const VITE_NODE_SOURCEMAPPING_URL = `${SOURCEMAPPING_URL}=data:application/json;charset=utf-8`
const VITE_NODE_SOURCEMAPPING_REGEXP = new RegExp(`//# ${VITE_NODE_SOURCEMAPPING_URL};base64,(.+)`)

export function withInlineSourcemap(result: TransformResult, options: {
  root: string // project root path of this resource
  filepath: string
}) {
  const map = result.map
  let code = result.code

  if (!map || code.includes(VITE_NODE_SOURCEMAPPING_SOURCE))
    return result

  // sources path from `ViteDevServer` may be not a valid filesystem path (eg. /src/main.js),
  // so we try to convert them to valid filesystem path
  map.sources = map.sources?.map((source) => {
    if (!source)
      return source
    // just a filename
    if (source === basename(source) && source === basename(options.filepath))
      return options.filepath
    const { exists, path } = toFilePath(source, options.root)
    return exists ? path : source
  })

  // to reduce the payload size, we only inline vite node source map, because it's also the only one we use
  const OTHER_SOURCE_MAP_REGEXP = new RegExp(`//# ${SOURCEMAPPING_URL}=data:application/json[^,]+base64,(.+)`, 'g')
  while (OTHER_SOURCE_MAP_REGEXP.test(code))
    code = code.replace(OTHER_SOURCE_MAP_REGEXP, '')

  const sourceMap = Buffer.from(JSON.stringify(map), 'utf-8').toString('base64')
  result.code = `${code.trimEnd()}\n\n${VITE_NODE_SOURCEMAPPING_SOURCE}\n//# ${VITE_NODE_SOURCEMAPPING_URL};base64,${sourceMap}\n`

  return result
}

export function extractSourceMap(code: string): EncodedSourceMap | null {
  const mapString = code.match(VITE_NODE_SOURCEMAPPING_REGEXP)?.[1]
  if (mapString)
    return JSON.parse(Buffer.from(mapString, 'base64').toString('utf-8'))
  return null
}

export function installSourcemapsSupport(options: InstallSourceMapSupportOptions) {
  install({
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

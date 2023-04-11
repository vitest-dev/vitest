import type { TransformResult } from 'vite'
import { dirname, isAbsolute, relative, resolve } from 'pathe'
import type { EncodedSourceMap } from '@jridgewell/trace-mapping'
import { install } from './source-map-handler'

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

  map.sources = map.sources?.map((source) => {
    if (!source)
      return source
    // sometimes files here are absolute,
    // but they are considered absolute to the server url, not the file system
    // this is a bug in Vite
    // all files should be either absolute to the file system or relative to the source map file
    if (isAbsolute(source) && !source.startsWith(options.root) && source.startsWith('/')) {
      const actualPath = resolve(options.root, source.slice(1))
      return relative(dirname(options.filepath), actualPath)
    }
    return source
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

import type { TransformResult } from 'vite'
import type { EncodedSourceMap } from './types'
import { dirname, isAbsolute, relative, resolve } from 'pathe'
import { install } from './source-map-handler'
import { withTrailingSlash } from './utils'

interface InstallSourceMapSupportOptions {
  getSourceMap: (source: string) => EncodedSourceMap | null | undefined
}

let SOURCEMAPPING_URL = 'sourceMa'
SOURCEMAPPING_URL += 'ppingURL'

const VITE_NODE_SOURCEMAPPING_SOURCE = '//# sourceMappingSource=vite-node'
const VITE_NODE_SOURCEMAPPING_URL = `${SOURCEMAPPING_URL}=data:application/json;charset=utf-8`

export function withInlineSourcemap(
  result: TransformResult,
  options: {
    root: string // project root path of this resource
    filepath: string
    noFirstLineMapping?: boolean
  },
): TransformResult {
  const map = result.map
  let code = result.code

  if (!map || code.includes(VITE_NODE_SOURCEMAPPING_SOURCE)) {
    return result
  }

  if ('sources' in map) {
    map.sources = map.sources?.map((source) => {
      if (!source) {
        return source
      }
      // sometimes files here are absolute,
      // but they are considered absolute to the server url, not the file system
      // this is a bug in Vite
      // all files should be either absolute to the file system or relative to the source map file
      if (isAbsolute(source)) {
        const actualPath
          = !source.startsWith(withTrailingSlash(options.root))
            && source.startsWith('/')
            ? resolve(options.root, source.slice(1))
            : source
        return relative(dirname(options.filepath), actualPath)
      }
      return source
    })
  }

  // to reduce the payload size, we only inline vite node source map, because it's also the only one we use
  const OTHER_SOURCE_MAP_REGEXP = new RegExp(
    `//# ${SOURCEMAPPING_URL}=data:application/json[^,]+base64,([A-Za-z0-9+/=]+)$`,
    'gm',
  )
  while (OTHER_SOURCE_MAP_REGEXP.test(code)) {
    code = code.replace(OTHER_SOURCE_MAP_REGEXP, '')
  }

  // If the first line is not present on source maps, add simple 1:1 mapping ([0,0,0,0], [1,0,0,0])
  // so that debuggers can be set to break on first line
  // Since Vite 6, import statements at the top of the file are preserved correctly,
  // so we don't need to add this mapping anymore.
  if (!options.noFirstLineMapping && map.mappings.startsWith(';')) {
    map.mappings = `AAAA,CAAA${map.mappings}`
  }

  const sourceMap = Buffer.from(JSON.stringify(map), 'utf-8').toString(
    'base64',
  )
  result.code = `${code.trimEnd()}\n\n${VITE_NODE_SOURCEMAPPING_SOURCE}\n//# ${VITE_NODE_SOURCEMAPPING_URL};base64,${sourceMap}\n`

  return result
}

export function extractSourceMap(code: string): EncodedSourceMap | null {
  const regexp = new RegExp(
    `//# ${VITE_NODE_SOURCEMAPPING_URL};base64,(.+)`,
    'gm',
  )
  let lastMatch!: RegExpExecArray | null, match!: RegExpExecArray | null
  // eslint-disable-next-line no-cond-assign
  while ((match = regexp.exec(code))) {
    lastMatch = match
  }
  // pick only the last source map keeping user strings that look like maps
  if (lastMatch) {
    return JSON.parse(Buffer.from(lastMatch[1], 'base64').toString('utf-8'))
  }
  return null
}

export function installSourcemapsSupport(
  options: InstallSourceMapSupportOptions,
): void {
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

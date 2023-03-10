import MagicString from 'magic-string'
import type { DecodedSourceMap, RawSourceMap } from '@ampproject/remapping'
import type { SourceMap } from 'rollup'
import type { TransformResult } from 'vite'
import remapping from '@ampproject/remapping'
import { getCallLastIndex } from '../utils'

const hoistRegexp = /^[ \t]*\b(?:__vite_ssr_import_\d+__\.)?((?:vitest|vi)\s*.\s*(mock|unmock)\(["`'\s]+(.*[@\w_-]+)["`'\s]+)[),]{1};?/gm

const API_NOT_FOUND_ERROR = `There are some problems in resolving the mocks API.
You may encounter this issue when importing the mocks API from another module other than 'vitest'.

To fix this issue you can either:
- import the mocks API directly from 'vitest'
- enable the 'globals' options`

export function hoistModuleMocks(mod: TransformResult, vitestPath: string): TransformResult {
  if (!mod.code)
    return mod
  const m = hoistCodeMocks(mod.code)

  if (m) {
    const vitestRegexp = new RegExp(`const __vite_ssr_import_\\d+__ = await __vite_ssr_import__\\("(?:\/@fs\/?)?${vitestPath}"\\);`, 'gm')
    // hoist vitest imports in case it was used inside vi.mock factory #425
    const vitestImports = mod.code.matchAll(vitestRegexp)
    let found = false

    for (const match of vitestImports) {
      const indexStart = match.index!
      const indexEnd = match[0].length + indexStart
      m.remove(indexStart, indexEnd)
      m.prepend(`${match[0]}\n`)
      found = true
    }

    // if no vitest import found, check if the mock API is reachable after the hoisting
    if (!found) {
      m.prepend('if (typeof globalThis.vi === "undefined" && typeof globalThis.vitest === "undefined") '
      + `{ throw new Error(${JSON.stringify(API_NOT_FOUND_ERROR)}) }\n`)
    }

    return {
      ...mod,
      code: m.toString(),
      map: mod.map
        ? combineSourcemaps(
          mod.map.file,
          [
            {
              ...m.generateMap({ hires: true }),
              sourcesContent: mod.map.sourcesContent,
            } as RawSourceMap,
            mod.map as RawSourceMap,
          ],
        ) as SourceMap
        : null,
    }
  }

  return mod
}

function hoistCodeMocks(code: string) {
  let m: MagicString | undefined
  const mocks = code.matchAll(hoistRegexp)

  for (const mockResult of mocks) {
    const lastIndex = getMockLastIndex(code.slice(mockResult.index!))

    if (lastIndex === null)
      continue

    const startIndex = mockResult.index!

    const { insideComment, insideString } = getIndexStatus(code, startIndex)

    if (insideComment || insideString)
      continue

    const endIndex = startIndex + lastIndex

    m ??= new MagicString(code)

    m.prepend(`${m.slice(startIndex, endIndex)}\n`)
    m.remove(startIndex, endIndex)
  }

  return m
}

function escapeToLinuxLikePath(path: string) {
  if (/^[A-Z]:/.test(path))
    return path.replace(/^([A-Z]):\//, '/windows/$1/')

  if (/^\/[^/]/.test(path))
    return `/linux${path}`

  return path
}

function unescapeToLinuxLikePath(path: string) {
  if (path.startsWith('/linux/'))
    return path.slice('/linux'.length)

  if (path.startsWith('/windows/'))
    return path.replace(/^\/windows\/([A-Z])\//, '$1:/')

  return path
}

// based on https://github.com/vitejs/vite/blob/6b40f03574cd71a17cbe564bc63adebb156ff06e/packages/vite/src/node/utils.ts#L727
const nullSourceMap: RawSourceMap = {
  names: [],
  sources: [],
  mappings: '',
  version: 3,
}
export function combineSourcemaps(
  filename: string,
  sourcemapList: Array<DecodedSourceMap | RawSourceMap>,
  excludeContent = true,
): RawSourceMap {
  if (
    sourcemapList.length === 0
    || sourcemapList.every(m => m.sources.length === 0)
  )
    return { ...nullSourceMap }

  // hack for parse broken with normalized absolute paths on windows (C:/path/to/something).
  // escape them to linux like paths
  // also avoid mutation here to prevent breaking plugin's using cache to generate sourcemaps like vue (see #7442)
  sourcemapList = sourcemapList.map((sourcemap) => {
    const newSourcemaps = { ...sourcemap }
    newSourcemaps.sources = sourcemap.sources.map(source =>
      source ? escapeToLinuxLikePath(source) : null,
    )
    if (sourcemap.sourceRoot)
      newSourcemaps.sourceRoot = escapeToLinuxLikePath(sourcemap.sourceRoot)

    return newSourcemaps
  })
  const escapedFilename = escapeToLinuxLikePath(filename)

  // We don't declare type here so we can convert/fake/map as RawSourceMap
  let map // : SourceMap
  let mapIndex = 1
  const useArrayInterface
    = sourcemapList.slice(0, -1).find(m => m.sources.length !== 1) === undefined
  if (useArrayInterface) {
    map = remapping(sourcemapList, () => null, excludeContent)
  }
  else {
    map = remapping(
      sourcemapList[0],
      (sourcefile) => {
        if (sourcefile === escapedFilename && sourcemapList[mapIndex])
          return sourcemapList[mapIndex++]

        else
          return null
      },
      excludeContent,
    )
  }
  if (!map.file)
    delete map.file

  // unescape the previous hack
  map.sources = map.sources.map(source =>
    source ? unescapeToLinuxLikePath(source) : source,
  )
  map.file = filename

  return map as RawSourceMap
}

function getMockLastIndex(code: string): number | null {
  const index = getCallLastIndex(code)
  if (index === null)
    return null
  return code[index + 1] === ';' ? index + 2 : index + 1
}

function getIndexStatus(code: string, from: number) {
  let index = 0
  let commentStarted = false
  let commentEnded = true
  let multilineCommentStarted = false
  let multilineCommentEnded = true
  let inString: string | null = null
  let beforeChar: string | null = null

  while (index <= from) {
    const char = code[index]
    const sub = code[index] + code[index + 1]

    if (!inString) {
      if (sub === '/*') {
        multilineCommentStarted = true
        multilineCommentEnded = false
      }
      if (sub === '*/' && multilineCommentStarted) {
        multilineCommentStarted = false
        multilineCommentEnded = true
      }
      if (sub === '//') {
        commentStarted = true
        commentEnded = false
      }
      if ((char === '\n' || sub === '\r\n') && commentStarted) {
        commentStarted = false
        commentEnded = true
      }
    }

    if (!multilineCommentStarted && !commentStarted) {
      const isCharString = char === '"' || char === '\'' || char === '`'

      if (isCharString && beforeChar !== '\\') {
        if (inString === char)
          inString = null
        else if (!inString)
          inString = char
      }
    }

    beforeChar = char
    index++
  }

  return {
    insideComment: !multilineCommentEnded || !commentEnded,
    insideString: inString !== null,
  }
}

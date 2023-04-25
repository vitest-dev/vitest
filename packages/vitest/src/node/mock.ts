import MagicString from 'magic-string'
import { Parser } from 'acorn'
import { findNodeAround, simple as walk } from 'acorn-walk'
import type { CallExpression, Expression, Identifier, ImportDeclaration, ImportExpression, VariableDeclaration } from 'estree'
import type { DecodedSourceMap, RawSourceMap } from '@ampproject/remapping'
import type { SourceMap } from 'rollup'
import type { TransformResult, ViteDevServer } from 'vite'
import remapping from '@ampproject/remapping'
import { getCallLastIndex, toArray } from '../utils'
import type { WorkspaceProject } from './workspace'
import type { Vitest } from './core'

type Positioned<T> = T & {
  start: number
  end: number
}

const parsers = new WeakMap<ViteDevServer, typeof Parser>()

function getAcornParser(server: ViteDevServer) {
  const acornPlugins = server.pluginContainer.options.acornInjectPlugins || []
  let parser = parsers.get(server)!
  if (!parser) {
    parser = Parser.extend(...toArray(acornPlugins) as any)
    parsers.set(server, parser)
  }
  return parser
}

const hoistRegexp = /^[ \t]*\b(?:__vite_ssr_import_\d+__\.)?((?:vitest|vi)\s*.\s*(mock|unmock)\(["`'\s]+(.*[@\w_-]+)["`'\s]+)[),]{1};?/gm

const API_NOT_FOUND_ERROR = `There are some problems in resolving the mocks API.
You may encounter this issue when importing the mocks API from another module other than 'vitest'.

To fix this issue you can either:
- import the mocks API directly from 'vitest'
- enable the 'globals' options`

const API_NOT_FOUND_CHECK = 'if (typeof globalThis.vi === "undefined" && typeof globalThis.vitest === "undefined") '
+ `{ throw new Error(${JSON.stringify(API_NOT_FOUND_ERROR)}) }\n`

export function hoistModuleMocks(mod: TransformResult, vitestPath: string): TransformResult {
  if (!mod.code)
    return mod
  const m = hoistCodeMocks(mod.code)

  if (m) {
    const vitestRegexp = new RegExp(`const __vite_ssr_import_\\d+__ = await __vite_ssr_import__\\("(?:\/@fs\/?)?(?:${vitestPath}|vitest)"\\);`, 'gm')
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

const regexpHoistable = /^[ \t]*\b(vi|vitest)\s*\.\s*(mock|unmock|hoist)/m
const hashbangRE = /^#!.*\n/

function isIdentifier(node: any): node is Positioned<Identifier> {
  return node.type === 'Identifier'
}

function transformImportSpecifiers(node: ImportDeclaration) {
  const specifiers = node.specifiers

  if (specifiers.length === 1 && specifiers[0].type === 'ImportNamespaceSpecifier')
    return specifiers[0].local.name

  const dynamicImports = node.specifiers.map((specifier) => {
    if (specifier.type === 'ImportDefaultSpecifier')
      return `default: ${specifier.local.name}`

    if (specifier.type === 'ImportSpecifier') {
      const local = specifier.local.name
      const imported = specifier.imported.name
      if (local === imported)
        return local
      return `${imported}: ${local}`
    }

    return null
  }).filter(Boolean).join(', ')

  return `{ ${dynamicImports} }`
}

export function transformMockableFile(project: WorkspaceProject | Vitest, id: string, source: string, needMap = false) {
  const hasMocks = regexpHoistable.test(source)
  const hijackEsm = project.config.slowHijackESM ?? false

  // we don't need to constrol __vitest_module__ in Node.js,
  // because we control the module resolution directly,
  // but we stil need to hoist mocks everywhere
  if (!hijackEsm && !hasMocks)
    return

  const parser = getAcornParser(project.server)
  const hoistIndex = source.match(hashbangRE)?.[0].length ?? 0
  let ast: any
  try {
    ast = parser.parse(source, {
      sourceType: 'module',
      ecmaVersion: 'latest',
      locations: true,
      allowHashBang: true,
    })
  }
  catch (err) {
    console.error(`[vitest] Not able to parse source code of ${id}.`)
    console.error(err)
    return
  }

  const magicString = new MagicString(source)

  let hoistedCalls = ''
  // hoist Vitest imports at the very top of the file
  let hoistedVitestImports = ''
  let idx = 0

  // this will tranfrom import statements into dynamic ones, if there are imports
  // it will keep the import as is, if we don't need to mock anything
  // in browser environment it will wrap the module value with "vitest_wrap_module" function
  // that returns a proxy to the module so that named exports can be mocked
  const transformImportDeclaration = (node: ImportDeclaration) => {
    // if we don't hijack ESM and process this file, then we definetly have mocks,
    // so we need to transform imports into dynamic ones, so "vi.mock" can be executed before
    if (!hijackEsm)
      return `const ${transformImportSpecifiers(node)} = await import('${node.source.value}')\n`

    const moduleName = `__vitest_module_${idx++}__`
    const destructured = `const ${transformImportSpecifiers(node)} = __vitest_wrap_module__(${moduleName})`
    if (hasMocks)
      return `const ${moduleName} = await import('${node.source.value}')\n${destructured}`
    return `import * as ${moduleName} from '${node.source.value}'\n${destructured}`
  }

  walk(ast, {
    ImportExpression(_node) {
      if (!hijackEsm)
        return
      const node = _node as any as Positioned<ImportExpression>
      const replace = '__vitest_wrap_module__(import('
      magicString.overwrite(node.start, (node.source as Positioned<Expression>).start, replace)
      magicString.overwrite(node.end - 1, node.end, '))')
    },

    ImportDeclaration(_node) {
      const node = _node as any as Positioned<ImportDeclaration>

      const start = node.start
      const end = node.end

      if (node.source.value === 'vitest') {
        hoistedVitestImports += transformImportDeclaration(node)
        magicString.remove(start, end)
        return
      }

      const dynamicImport = transformImportDeclaration(node)

      magicString.overwrite(start, end, dynamicImport)
    },

    CallExpression(_node) {
      const node = _node as any as Positioned<CallExpression>

      if (
        node.callee.type === 'MemberExpression'
        && isIdentifier(node.callee.object)
        && (node.callee.object.name === 'vi' || node.callee.object.name === 'vitest')
        && isIdentifier(node.callee.property)
      ) {
        const methodName = node.callee.property.name
        if (methodName === 'mock' || methodName === 'unmock') {
          hoistedCalls += `${source.slice(node.start, node.end)}\n`
          magicString.remove(node.start, node.end)
        }
        if (methodName === 'hoisted') {
          const declarationNode = findNodeAround(ast, node.start, 'VariableDeclaration')?.node as Positioned<VariableDeclaration> | undefined
          const init = declarationNode?.declarations[0]?.init
          if (
            init
            && init.type === 'CallExpression'
            && init.callee.type === 'MemberExpression'
            && isIdentifier(init.callee.object)
            && (node.callee.object.name === 'vi' || node.callee.object.name === 'vitest')
            && isIdentifier(init.callee.property)
            && init.callee.property.name === 'hoisted'
          ) {
            // hoist const variable = vi.hoisted(() => {})
            hoistedCalls += `${source.slice(declarationNode.start, declarationNode.end)}\n`
            magicString.remove(declarationNode.start, declarationNode.end)
          }
          else {
            // hoist vi.hoisted(() => {})
            hoistedCalls += `${source.slice(node.start, node.end)}\n`
            magicString.remove(node.start, node.end)
          }
        }
      }
    },
  })

  if (hasMocks)
    hoistedCalls += 'await __vitest_mocker__.prepare()\n'

  magicString.appendLeft(
    hoistIndex,
    hoistedVitestImports
    + (hoistedVitestImports ? '' : API_NOT_FOUND_CHECK)
    + hoistedCalls,
  )

  const code = magicString.toString()
  const map = needMap ? magicString.generateMap({ hires: true }) : null

  return {
    code,
    map,
  }
}

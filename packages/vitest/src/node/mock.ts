import MagicString from 'magic-string'
import { Parser } from 'acorn'
import { findNodeAround, simple as walk } from 'acorn-walk'
import type { CallExpression, Expression, Identifier, ImportDeclaration, ImportExpression, VariableDeclaration } from 'estree'
import type { ViteDevServer } from 'vite'
import { toArray } from '../utils'
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

const API_NOT_FOUND_ERROR = `There are some problems in resolving the mocks API.
You may encounter this issue when importing the mocks API from another module other than 'vitest'.

To fix this issue you can either:
- import the mocks API directly from 'vitest'
- enable the 'globals' options`

const API_NOT_FOUND_CHECK = 'if (typeof globalThis.vi === "undefined" && typeof globalThis.vitest === "undefined") '
+ `{ throw new Error(${JSON.stringify(API_NOT_FOUND_ERROR)}) }\n`

const regexpHoistable = /^[ \t]*\b(vi|vitest)\s*\.\s*(mock|unmock|hoisted)\(/m
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

  if (!dynamicImports.length)
    return ''

  return `{ ${dynamicImports} }`
}

export function transformMockableFile(project: WorkspaceProject | Vitest, id: string, source: string, needMap = false) {
  const hasMocks = regexpHoistable.test(source)
  const hijackEsm = project.config.slowHijackESM ?? false

  // we don't need to control __vitest_module__ in Node.js,
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
    const specifiers = transformImportSpecifiers(node)
    // if we don't hijack ESM and process this file, then we definetly have mocks,
    // so we need to transform imports into dynamic ones, so "vi.mock" can be executed before
    if (!hijackEsm) {
      return specifiers
        ? `const ${specifiers} = await import('${node.source.value}')\n`
        : `await import('${node.source.value}')\n`
    }

    const moduleName = `__vitest_module_${idx++}__`
    const destructured = `const ${specifiers} = __vitest_wrap_module__(${moduleName})\n`
    if (hasMocks) {
      return specifiers
        ? `const ${moduleName} = await import('${node.source.value}')\n${destructured}`
        : `await __vitest_wrap_module__(import('${node.source.value}'))\n`
    }
    return specifiers
      ? `import * as ${moduleName} from '${node.source.value}'\n${destructured}`
      : `import '${node.source.value}'\n`
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
            // hoist "const variable = vi.hoisted(() => {})"
            hoistedCalls += `${source.slice(declarationNode.start, declarationNode.end)}\n`
            magicString.remove(declarationNode.start, declarationNode.end)
          }
          else {
            // hoist "vi.hoisted(() => {})"
            hoistedCalls += `${source.slice(node.start, node.end)}\n`
            magicString.remove(node.start, node.end)
          }
        }
      }
    },
  })

  if (hasMocks)
    hoistedCalls += '\nawait __vitest_mocker__.prepare()\n'

  magicString.appendLeft(
    hoistIndex,
    hoistedVitestImports
    + ((!hoistedVitestImports && hoistedCalls) ? API_NOT_FOUND_CHECK : '')
    + hoistedCalls,
  )

  const code = magicString.toString()
  const map = needMap ? magicString.generateMap({ hires: true, source: id }) : null

  return {
    code,
    map,
  }
}

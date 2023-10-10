import MagicString from 'magic-string'
import type { CallExpression, Identifier, ImportDeclaration, ImportNamespaceSpecifier, VariableDeclaration, Node as _Node } from 'estree'
import { findNodeAround, simple as simpleWalk } from 'acorn-walk'
import type { AcornNode } from 'rollup'

export type Positioned<T> = T & {
  start: number
  end: number
}

export type Node = Positioned<_Node>

const API_NOT_FOUND_ERROR = `There are some problems in resolving the mocks API.
You may encounter this issue when importing the mocks API from another module other than 'vitest'.
To fix this issue you can either:
- import the mocks API directly from 'vitest'
- enable the 'globals' options`

const API_NOT_FOUND_CHECK = '\nif (typeof globalThis.vi === "undefined" && typeof globalThis.vitest === "undefined") '
+ `{ throw new Error(${JSON.stringify(API_NOT_FOUND_ERROR)}) }\n`

function isIdentifier(node: any): node is Positioned<Identifier> {
  return node.type === 'Identifier'
}

function transformImportSpecifiers(node: ImportDeclaration) {
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

const regexpHoistable = /^[ \t]*\b(vi|vitest)\s*\.\s*(mock|unmock|hoisted)\(/m
const regexpAssignedHoisted = /=[ \t]*(\bawait|)[ \t]*\b(vi|vitest)\s*\.\s*hoisted\(/
const hashbangRE = /^#!.*\n/

export function hoistMocks(code: string, id: string, parse: (code: string, options: any) => AcornNode) {
  const hasMocks = regexpHoistable.test(code) || regexpAssignedHoisted.test(code)

  if (!hasMocks)
    return

  const s = new MagicString(code)

  let ast: any
  try {
    ast = parse(code, {
      sourceType: 'module',
      ecmaVersion: 'latest',
      locations: true,
    })
  }
  catch (err) {
    console.error(`Cannot parse ${id}:\n${(err as any).message}`)
    return
  }

  const hoistIndex = code.match(hashbangRE)?.[0].length ?? 0

  let hoistedCode = ''
  let hoistedVitestImports = ''

  // this will tranfrom import statements into dynamic ones, if there are imports
  // it will keep the import as is, if we don't need to mock anything
  // in browser environment it will wrap the module value with "vitest_wrap_module" function
  // that returns a proxy to the module so that named exports can be mocked
  const transformImportDeclaration = (node: ImportDeclaration) => {
    const source = node.source.value as string

    const namespace = node.specifiers.find(specifier => specifier.type === 'ImportNamespaceSpecifier') as ImportNamespaceSpecifier | undefined

    let code = ''
    if (namespace)
      code += `const ${namespace.local.name} = await import('${source}')\n`

    // if we don't hijack ESM and process this file, then we definetly have mocks,
    // so we need to transform imports into dynamic ones, so "vi.mock" can be executed before
    const specifiers = transformImportSpecifiers(node)

    if (specifiers) {
      if (namespace)
        code += `const ${specifiers} = ${namespace.local.name}\n`
      else
        code += `const ${specifiers} = await import('${source}')\n`
    }
    else if (!namespace) {
      code += `await import('${source}')\n`
    }
    return code
  }

  function hoistImport(node: Positioned<ImportDeclaration>) {
    // always hoist vitest import to top of the file, so
    // "vi" helpers can access it
    s.remove(node.start, node.end)

    if (node.source.value === 'vitest') {
      const code = `const ${transformImportSpecifiers(node)} = await import('vitest')\n`
      hoistedVitestImports += code
      return
    }
    const code = transformImportDeclaration(node)
    s.appendLeft(hoistIndex, code)
  }

  // 1. check all import statements and record id -> importName map
  for (const node of ast.body as Node[]) {
    // import foo from 'foo' --> foo -> __import_foo__.default
    // import { baz } from 'foo' --> baz -> __import_foo__.baz
    // import * as ok from 'foo' --> ok -> __import_foo__
    if (node.type === 'ImportDeclaration')
      hoistImport(node)
  }

  simpleWalk(ast, {
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
          hoistedCode += `${code.slice(node.start, node.end)}\n`
          s.remove(node.start, node.end)
        }

        if (methodName === 'hoisted') {
          const declarationNode = findNodeAround(ast, node.start, 'VariableDeclaration')?.node as Positioned<VariableDeclaration> | undefined
          const init = declarationNode?.declarations[0]?.init
          const isViHoisted = (node: CallExpression) => {
            return node.callee.type === 'MemberExpression'
              && isIdentifier(node.callee.object)
              && (node.callee.object.name === 'vi' || node.callee.object.name === 'vitest')
              && isIdentifier(node.callee.property)
              && node.callee.property.name === 'hoisted'
          }

          const canMoveDeclaration = (init
            && init.type === 'CallExpression'
            && isViHoisted(init)) /* const v = vi.hoisted() */
            || (init
                && init.type === 'AwaitExpression'
                && init.argument.type === 'CallExpression'
                && isViHoisted(init.argument)) /* const v = await vi.hoisted() */

          if (canMoveDeclaration) {
            // hoist "const variable = vi.hoisted(() => {})"
            hoistedCode += `${code.slice(declarationNode.start, declarationNode.end)}\n`
            s.remove(declarationNode.start, declarationNode.end)
          }
          else {
            // hoist "vi.hoisted(() => {})"
            hoistedCode += `${code.slice(node.start, node.end)}\n`
            s.remove(node.start, node.end)
          }
        }
      }
    },
  })

  if (hoistedCode || hoistedVitestImports) {
    s.prepend(
      hoistedVitestImports
      + ((!hoistedVitestImports && hoistedCode) ? API_NOT_FOUND_CHECK : '')
      + hoistedCode,
    )
  }

  return {
    ast,
    code: s.toString(),
    map: s.generateMap({ hires: 'boundary', source: id }),
  }
}

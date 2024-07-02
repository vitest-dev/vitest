import MagicString from 'magic-string'
import type {
  AwaitExpression,
  CallExpression,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  Expression,
  Identifier,
  ImportDeclaration,
  ImportExpression,
  VariableDeclaration,
  Node as _Node,
} from 'estree'
import { findNodeAround } from 'acorn-walk'
import type { PluginContext, ProgramNode } from 'rollup'
import { esmWalker } from '@vitest/utils/ast'
import type { Colors } from '@vitest/utils'
import { highlightCode } from '../utils/colors'
import { generateCodeFrame } from './error'

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

const API_NOT_FOUND_CHECK
  = '\nif (typeof globalThis.vi === "undefined" && typeof globalThis.vitest === "undefined") '
  + `{ throw new Error(${JSON.stringify(API_NOT_FOUND_ERROR)}) }\n`

function isIdentifier(node: any): node is Positioned<Identifier> {
  return node.type === 'Identifier'
}

function transformImportSpecifiers(node: ImportDeclaration) {
  const dynamicImports = node.specifiers
    .map((specifier) => {
      if (specifier.type === 'ImportDefaultSpecifier') {
        return `default: ${specifier.local.name}`
      }

      if (specifier.type === 'ImportSpecifier') {
        const local = specifier.local.name
        const imported = specifier.imported.name
        if (local === imported) {
          return local
        }
        return `${imported}: ${local}`
      }

      return null
    })
    .filter(Boolean)
    .join(', ')

  if (!dynamicImports.length) {
    return ''
  }

  return `{ ${dynamicImports} }`
}

export function getBetterEnd(code: string, node: Node) {
  let end = node.end
  if (code[node.end] === ';') {
    end += 1
  }
  if (code[node.end + 1] === '\n') {
    end += 1
  }
  return end
}

const regexpHoistable
  = /\b(?:vi|vitest)\s*\.\s*(?:mock|unmock|hoisted|doMock|doUnmock)\(/
const hashbangRE = /^#!.*\n/

export function hoistMocks(
  code: string,
  id: string,
  parse: PluginContext['parse'],
  colors?: Colors,
) {
  const needHoisting = regexpHoistable.test(code)

  if (!needHoisting) {
    return
  }

  const s = new MagicString(code)

  let ast: ProgramNode
  try {
    ast = parse(code)
  }
  catch (err) {
    console.error(`Cannot parse ${id}:\n${(err as any).message}`)
    return
  }

  const hoistIndex = code.match(hashbangRE)?.[0].length ?? 0

  let hoistedVitestImports = ''

  let uid = 0
  const idToImportMap = new Map<string, string>()

  // this will transform import statements into dynamic ones, if there are imports
  // it will keep the import as is, if we don't need to mock anything
  // in browser environment it will wrap the module value with "vitest_wrap_module" function
  // that returns a proxy to the module so that named exports can be mocked
  const transformImportDeclaration = (node: ImportDeclaration) => {
    const source = node.source.value as string

    const importId = `__vi_import_${uid++}__`
    const hasSpecifiers = node.specifiers.length > 0
    const code = hasSpecifiers
      ? `const ${importId} = await import('${source}')\n`
      : `await import('${source}')\n`
    return {
      code,
      id: importId,
    }
  }

  function defineImport(node: Positioned<ImportDeclaration>) {
    // always hoist vitest import to top of the file, so
    // "vi" helpers can access it
    if (node.source.value === 'vitest') {
      const code = `const ${transformImportSpecifiers(
        node,
      )} = await import('vitest')\n`
      hoistedVitestImports += code
      s.remove(node.start, getBetterEnd(code, node))
      return
    }

    const declaration = transformImportDeclaration(node)
    if (!declaration) {
      return null
    }
    s.appendLeft(hoistIndex, declaration.code)
    return declaration.id
  }

  // 1. check all import statements and record id -> importName map
  for (const node of ast.body as Node[]) {
    // import foo from 'foo' --> foo -> __import_foo__.default
    // import { baz } from 'foo' --> baz -> __import_foo__.baz
    // import * as ok from 'foo' --> ok -> __import_foo__
    if (node.type === 'ImportDeclaration') {
      const importId = defineImport(node)
      if (!importId) {
        continue
      }
      s.remove(node.start, getBetterEnd(code, node))
      for (const spec of node.specifiers) {
        if (spec.type === 'ImportSpecifier') {
          idToImportMap.set(
            spec.local.name,
            `${importId}.${spec.imported.name}`,
          )
        }
        else if (spec.type === 'ImportDefaultSpecifier') {
          idToImportMap.set(spec.local.name, `${importId}.default`)
        }
        else {
          // namespace specifier
          idToImportMap.set(spec.local.name, importId)
        }
      }
    }
  }

  const declaredConst = new Set<string>()
  const hoistedNodes: Positioned<
    CallExpression | VariableDeclaration | AwaitExpression
  >[] = []

  function createSyntaxError(node: Positioned<Node>, message: string) {
    const _error = new SyntaxError(message)
    Error.captureStackTrace(_error, createSyntaxError)
    return {
      name: 'SyntaxError',
      message: _error.message,
      stack: _error.stack,
      frame: generateCodeFrame(
        highlightCode(id, code, colors),
        4,
        node.start + 1,
      ),
    }
  }

  function assertNotDefaultExport(
    node: Positioned<CallExpression>,
    error: string,
  ) {
    const defaultExport = findNodeAround(
      ast,
      node.start,
      'ExportDefaultDeclaration',
    )?.node as Positioned<ExportDefaultDeclaration> | undefined
    if (
      defaultExport?.declaration === node
      || (defaultExport?.declaration.type === 'AwaitExpression'
      && defaultExport.declaration.argument === node)
    ) {
      throw createSyntaxError(defaultExport, error)
    }
  }

  function assertNotNamedExport(
    node: Positioned<VariableDeclaration>,
    error: string,
  ) {
    const nodeExported = findNodeAround(
      ast,
      node.start,
      'ExportNamedDeclaration',
    )?.node as Positioned<ExportNamedDeclaration> | undefined
    if (nodeExported?.declaration === node) {
      throw createSyntaxError(nodeExported, error)
    }
  }

  function getVariableDeclaration(node: Positioned<CallExpression>) {
    const declarationNode = findNodeAround(
      ast,
      node.start,
      'VariableDeclaration',
    )?.node as Positioned<VariableDeclaration> | undefined
    const init = declarationNode?.declarations[0]?.init
    if (
      init
      && (init === node
      || (init.type === 'AwaitExpression' && init.argument === node))
    ) {
      return declarationNode
    }
  }

  esmWalker(ast, {
    onIdentifier(id, info, parentStack) {
      const binding = idToImportMap.get(id.name)
      if (!binding) {
        return
      }

      if (info.hasBindingShortcut) {
        s.appendLeft(id.end, `: ${binding}`)
      }
      else if (info.classDeclaration) {
        if (!declaredConst.has(id.name)) {
          declaredConst.add(id.name)
          // locate the top-most node containing the class declaration
          const topNode = parentStack[parentStack.length - 2]
          s.prependRight(topNode.start, `const ${id.name} = ${binding};\n`)
        }
      }
      else if (
        // don't transform class name identifier
        !info.classExpression
      ) {
        s.update(id.start, id.end, binding)
      }
    },
    onCallExpression(node) {
      if (
        node.callee.type === 'MemberExpression'
        && isIdentifier(node.callee.object)
        && (node.callee.object.name === 'vi'
        || node.callee.object.name === 'vitest')
        && isIdentifier(node.callee.property)
      ) {
        const methodName = node.callee.property.name

        if (methodName === 'mock' || methodName === 'unmock') {
          const method = `${node.callee.object.name}.${methodName}`
          assertNotDefaultExport(
            node,
            `Cannot export the result of "${method}". Remove export declaration because "${method}" doesn\'t return anything.`,
          )
          const declarationNode = getVariableDeclaration(node)
          if (declarationNode) {
            assertNotNamedExport(
              declarationNode,
              `Cannot export the result of "${method}". Remove export declaration because "${method}" doesn\'t return anything.`,
            )
          }
          hoistedNodes.push(node)
        }

        // vi.doMock(import('./path')) -> vi.doMock('./path')
        // vi.doMock(await import('./path')) -> vi.doMock('./path')
        if (methodName === 'doMock' || methodName === 'doUnmock') {
          const moduleInfo = node.arguments[0] as Positioned<Expression>
          let source: Positioned<Expression> | null = null
          if (moduleInfo.type === 'ImportExpression') {
            source = moduleInfo.source as Positioned<Expression>
          }
          if (
            moduleInfo.type === 'AwaitExpression'
            && moduleInfo.argument.type === 'ImportExpression'
          ) {
            source = moduleInfo.argument.source as Positioned<Expression>
          }
          if (source) {
            s.overwrite(
              moduleInfo.start,
              moduleInfo.end,
              s.slice(source.start, source.end),
            )
          }
        }

        if (methodName === 'hoisted') {
          assertNotDefaultExport(
            node,
            'Cannot export hoisted variable. You can control hoisting behavior by placing the import from this file first.',
          )

          const declarationNode = getVariableDeclaration(node)
          if (declarationNode) {
            assertNotNamedExport(
              declarationNode,
              'Cannot export hoisted variable. You can control hoisting behavior by placing the import from this file first.',
            )
            // hoist "const variable = vi.hoisted(() => {})"
            hoistedNodes.push(declarationNode)
          }
          else {
            const awaitedExpression = findNodeAround(
              ast,
              node.start,
              'AwaitExpression',
            )?.node as Positioned<AwaitExpression> | undefined
            // hoist "await vi.hoisted(async () => {})" or "vi.hoisted(() => {})"
            hoistedNodes.push(
              awaitedExpression?.argument === node ? awaitedExpression : node,
            )
          }
        }
      }
    },
  })

  function getNodeName(node: CallExpression) {
    const callee = node.callee || {}
    if (
      callee.type === 'MemberExpression'
      && isIdentifier(callee.property)
      && isIdentifier(callee.object)
    ) {
      return `${callee.object.name}.${callee.property.name}()`
    }
    return '"hoisted method"'
  }

  function getNodeCall(node: Node): Positioned<CallExpression> {
    if (node.type === 'CallExpression') {
      return node
    }
    if (node.type === 'VariableDeclaration') {
      const { declarations } = node
      const init = declarations[0].init
      if (init) {
        return getNodeCall(init as Node)
      }
    }
    if (node.type === 'AwaitExpression') {
      const { argument } = node
      if (argument.type === 'CallExpression') {
        return getNodeCall(argument as Node)
      }
    }
    return node as Positioned<CallExpression>
  }

  function createError(outsideNode: Node, insideNode: Node) {
    const outsideCall = getNodeCall(outsideNode)
    const insideCall = getNodeCall(insideNode)
    throw createSyntaxError(
      insideCall,
      `Cannot call ${getNodeName(insideCall)} inside ${getNodeName(
        outsideCall,
      )}: both methods are hoisted to the top of the file and not actually called inside each other.`,
    )
  }

  function rewriteMockDynamicImport(
    nodeCode: string,
    moduleInfo: Positioned<ImportExpression>,
    expressionStart: number,
    expressionEnd: number,
    mockStart: number,
  ) {
    const source = moduleInfo.source as Positioned<Expression>
    const importPath = s.slice(source.start, source.end)
    const nodeCodeStart = expressionStart - mockStart
    const nodeCodeEnd = expressionEnd - mockStart
    return (
      nodeCode.slice(0, nodeCodeStart)
      + importPath
      + nodeCode.slice(nodeCodeEnd)
    )
  }

  // validate hoistedNodes doesn't have nodes inside other nodes
  for (let i = 0; i < hoistedNodes.length; i++) {
    const node = hoistedNodes[i]
    for (let j = i + 1; j < hoistedNodes.length; j++) {
      const otherNode = hoistedNodes[j]

      if (node.start >= otherNode.start && node.end <= otherNode.end) {
        throw createError(otherNode, node)
      }
      if (otherNode.start >= node.start && otherNode.end <= node.end) {
        throw createError(node, otherNode)
      }
    }
  }

  // Wait for imports to be hoisted and then hoist the mocks
  const hoistedCode = hoistedNodes
    .map((node) => {
      const end = getBetterEnd(code, node)
      /**
       * In the following case, we need to change the `user` to user: __vi_import_x__.user
       * So we should get the latest code from `s`.
       *
       * import user from './user'
       * vi.mock('./mock.js', () => ({ getSession: vi.fn().mockImplementation(() => ({ user })) }))
       */
      let nodeCode = s.slice(node.start, end)

      // rewrite vi.mock(import('..')) into vi.mock('..')
      if (
        node.type === 'CallExpression'
        && node.callee.type === 'MemberExpression'
        && ((node.callee.property as Identifier).name === 'mock'
        || (node.callee.property as Identifier).name === 'unmock')
      ) {
        const moduleInfo = node.arguments[0] as Positioned<Expression>
        // vi.mock(import('./path')) -> vi.mock('./path')
        if (moduleInfo.type === 'ImportExpression') {
          nodeCode = rewriteMockDynamicImport(
            nodeCode,
            moduleInfo,
            moduleInfo.start,
            moduleInfo.end,
            node.start,
          )
        }
        // vi.mock(await import('./path')) -> vi.mock('./path')
        if (
          moduleInfo.type === 'AwaitExpression'
          && moduleInfo.argument.type === 'ImportExpression'
        ) {
          nodeCode = rewriteMockDynamicImport(
            nodeCode,
            moduleInfo.argument as Positioned<ImportExpression>,
            moduleInfo.start,
            moduleInfo.end,
            node.start,
          )
        }
      }

      s.remove(node.start, end)
      return `${nodeCode}${nodeCode.endsWith('\n') ? '' : '\n'}`
    })
    .join('')

  if (hoistedCode || hoistedVitestImports) {
    s.prepend(
      hoistedVitestImports
      + (!hoistedVitestImports && hoistedCode ? API_NOT_FOUND_CHECK : '')
      + hoistedCode,
    )
  }

  return {
    ast,
    code: s.toString(),
    map: s.generateMap({ hires: 'boundary', source: id }),
  }
}

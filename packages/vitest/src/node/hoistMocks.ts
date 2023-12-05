import MagicString from 'magic-string'
import type { CallExpression, Identifier, ImportDeclaration, VariableDeclaration, Node as _Node } from 'estree'
import { findNodeAround, simple as simpleWalk } from 'acorn-walk'
import type { PluginContext } from 'rollup'
import { esmWalker, isInDestructuringAssignment, isNodeInPattern, isStaticProperty } from '@vitest/utils/ast'

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

export function hoistMocks(code: string, id: string, parse: PluginContext['parse']) {
  const hasMocks = regexpHoistable.test(code) || regexpAssignedHoisted.test(code)

  if (!hasMocks)
    return

  const s = new MagicString(code)

  let ast: any
  try {
    ast = parse(code)
  }
  catch (err) {
    console.error(`Cannot parse ${id}:\n${(err as any).message}`)
    return
  }

  const hoistIndex = code.match(hashbangRE)?.[0].length ?? 0

  let hoistedCode = ''
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
      const code = `const ${transformImportSpecifiers(node)} = await import('vitest')\n`
      hoistedVitestImports += code
      s.remove(node.start, node.end)
      return
    }

    const declaration = transformImportDeclaration(node)
    if (!declaration)
      return null
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
      if (!importId)
        continue
      s.remove(node.start, node.end)
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

  esmWalker(ast, {
    onIdentifier(id, parent, parentStack) {
      const grandparent = parentStack[1]
      const binding = idToImportMap.get(id.name)
      if (!binding)
        return

      if (isStaticProperty(parent) && parent.shorthand) {
        // let binding used in a property shorthand
        // { foo } -> { foo: __import_x__.foo }
        // skip for destructuring patterns
        if (
          !isNodeInPattern(parent)
            || isInDestructuringAssignment(parent, parentStack)
        )
          s.appendLeft(id.end, `: ${binding}`)
      }
      else if (
        (parent.type === 'PropertyDefinition'
            && grandparent?.type === 'ClassBody')
          || (parent.type === 'ClassDeclaration' && id === parent.superClass)
      ) {
        if (!declaredConst.has(id.name)) {
          declaredConst.add(id.name)
          // locate the top-most node containing the class declaration
          const topNode = parentStack[parentStack.length - 2]
          s.prependRight(topNode.start, `const ${id.name} = ${binding};\n`)
        }
      }
      else if (
        // don't transform class name identifier
        !(parent.type === 'ClassExpression' && id === parent.id)
      ) {
        s.update(id.start, id.end, binding)
      }
    },
    onDynamicImport() {},
    onImportMeta() {},
  })

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

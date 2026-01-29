import type {
  AwaitExpression,
  CallExpression,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  Expression,
  Identifier,
  ImportDeclaration,
  VariableDeclaration,
} from 'estree'
import type { Node, Positioned } from './esmWalker'
import { findNodeAround } from 'acorn-walk'
import MagicString from 'magic-string'
import { esmWalker } from './esmWalker'

export interface HoistMocksOptions {
  /**
   * List of modules that should always be imported before compiler hints.
   * @default 'vitest'
   */
  hoistedModule?: string
  /**
   * @default ["vi", "vitest"]
   */
  utilsObjectNames?: string[]
  /**
   * @default ["mock", "unmock"]
   */
  hoistableMockMethodNames?: string[]
  /**
   * @default ["mock", "unmock", "doMock", "doUnmock"]
   */
  dynamicImportMockMethodNames?: string[]
  /**
   * @default ["hoisted"]
   */
  hoistedMethodNames?: string[]
  globalThisAccessor?: string
  regexpHoistable?: RegExp
  codeFrameGenerator?: CodeFrameGenerator
  magicString?: () => MagicString
}

const API_NOT_FOUND_ERROR = `There are some problems in resolving the mocks API.
You may encounter this issue when importing the mocks API from another module other than 'vitest'.
To fix this issue you can either:
- import the mocks API directly from 'vitest'
- enable the 'globals' option`

function API_NOT_FOUND_CHECK(names: string[]) {
  return `\nif (${names.map(name => `typeof globalThis["${name}"] === "undefined"`).join(' && ')}) `
    + `{ throw new Error(${JSON.stringify(API_NOT_FOUND_ERROR)}) }\n`
}

function isIdentifier(node: any): node is Positioned<Identifier> {
  return node.type === 'Identifier'
}

function getNodeTail(code: string, node: Node) {
  let end = node.end
  if (code[node.end] === ';') {
    end += 1
  }
  if (code[node.end] === '\n') {
    return end + 1
  }
  if (code[node.end + 1] === '\n') {
    end += 1
  }
  return end
}

const regexpHoistable
  = /\b(?:vi|vitest)\s*\.\s*(?:mock|unmock|hoisted|doMock|doUnmock)\s*\(/
const hashbangRE = /^#!.*\n/

// this is a fork of Vite SSR transform
export function hoistMocks(
  code: string,
  id: string,
  parse: (code: string) => any,
  options: HoistMocksOptions = {},
): MagicString | undefined {
  const needHoisting = (options.regexpHoistable || regexpHoistable).test(code)

  if (!needHoisting) {
    return
  }

  const s = options.magicString?.() || new MagicString(code)

  let ast: any
  try {
    ast = parse(code)
  }
  catch (err) {
    console.error(`Cannot parse ${id}:\n${(err as any).message}.`)
    return
  }

  const {
    hoistableMockMethodNames = ['mock', 'unmock'],
    dynamicImportMockMethodNames = ['mock', 'unmock', 'doMock', 'doUnmock'],
    hoistedMethodNames = ['hoisted'],
    utilsObjectNames = ['vi', 'vitest'],
    hoistedModule = 'vitest',
  } = options

  // hoist at the start of the file, after the hashbang
  const hashbangEnd = hashbangRE.exec(code)?.[0].length ?? 0
  let hoistIndex = hashbangEnd

  let hoistedModuleImported = false

  let uid = 0
  const idToImportMap = new Map<string, string>()

  const imports: {
    node: Positioned<ImportDeclaration>
    id: string
  }[] = []

  // this will transform import statements into dynamic ones, if there are imports
  // it will keep the import as is, if we don't need to mock anything
  // in browser environment it will wrap the module value with "vitest_wrap_module" function
  // that returns a proxy to the module so that named exports can be mocked
  function defineImport(
    importNode: ImportDeclaration & {
      start: number
      end: number
    },
  ) {
    const source = importNode.source.value as string
    // always hoist vitest import to top of the file, so
    // "vi" helpers can access it
    if (hoistedModule === source) {
      hoistedModuleImported = true
      return
    }
    const importId = `__vi_import_${uid++}__`
    imports.push({ id: importId, node: importNode })

    return importId
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
      for (const spec of node.specifiers) {
        if (spec.type === 'ImportSpecifier') {
          if (spec.imported.type === 'Identifier') {
            idToImportMap.set(
              spec.local.name,
              `${importId}.${spec.imported.name}`,
            )
          }
          else {
            idToImportMap.set(
              spec.local.name,
              `${importId}[${JSON.stringify(spec.imported.value as string)}]`,
            )
          }
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
  const hoistedNodes: Set<Positioned<
  CallExpression | VariableDeclaration | AwaitExpression
  >> = new Set()

  function createSyntaxError(node: Positioned<Node>, message: string) {
    const _error = new SyntaxError(message)
    Error.captureStackTrace(_error, createSyntaxError)
    const serializedError: any = {
      name: 'SyntaxError',
      message: _error.message,
      stack: _error.stack,
    }
    if (options.codeFrameGenerator) {
      serializedError.frame = options.codeFrameGenerator(node, id, code)
    }
    return serializedError
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

  const usedUtilityExports = new Set<string>()
  let hasImportMetaVitest = false

  esmWalker(ast, {
    onImportMeta(node) {
      const property = code.slice(node.end, node.end + 7) // '.vitest'.length
      if (property === '.vitest') {
        hasImportMetaVitest = true
      }
    },
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
    onDynamicImport(_node) {
      // TODO: vi.mock(import) breaks it, and vi.mock('', () => import) also does,
      // only move imports that are outside of vi.mock
      // backwards compat, don't do if not passed
      // if (!options.globalThisAccessor) {
      //   return
      // }

      // const globalThisAccessor = options.globalThisAccessor
      // const replaceString = `globalThis[${globalThisAccessor}].wrapDynamicImport(() => import(`
      // const importSubstring = code.substring(node.start, node.end)
      // const hasIgnore = importSubstring.includes('/* @vite-ignore */')
      // s.overwrite(
      //   node.start,
      //   (node.source as Positioned<Expression>).start,
      //   replaceString + (hasIgnore ? '/* @vite-ignore */ ' : ''),
      // )
      // s.overwrite(node.end - 1, node.end, '))')
    },
    onCallExpression(node) {
      if (
        node.callee.type === 'MemberExpression'
        && isIdentifier(node.callee.object)
        && utilsObjectNames.includes(node.callee.object.name)
        && isIdentifier(node.callee.property)
      ) {
        const methodName = node.callee.property.name
        usedUtilityExports.add(node.callee.object.name)

        if (hoistableMockMethodNames.includes(methodName)) {
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
          // rewrite vi.mock(import('..')) into vi.mock('..')
          if (
            node.type === 'CallExpression'
            && node.callee.type === 'MemberExpression'
            && dynamicImportMockMethodNames.includes((node.callee.property as Identifier).name)
          ) {
            const moduleInfo = node.arguments[0] as Positioned<Expression>
            // vi.mock(import('./path')) -> vi.mock('./path')
            if (moduleInfo.type === 'ImportExpression') {
              const source = moduleInfo.source as Positioned<Expression>
              s.overwrite(
                moduleInfo.start,
                moduleInfo.end,
                s.slice(source.start, source.end),
              )
            }
            // vi.mock(await import('./path')) -> vi.mock('./path')
            if (
              moduleInfo.type === 'AwaitExpression'
              && moduleInfo.argument.type === 'ImportExpression'
            ) {
              const source = moduleInfo.argument.source as Positioned<Expression>
              s.overwrite(
                moduleInfo.start,
                moduleInfo.end,
                s.slice(source.start, source.end),
              )
            }
          }
          hoistedNodes.add(node)
        }
        // vi.doMock(import('./path')) -> vi.doMock('./path')
        // vi.doMock(await import('./path')) -> vi.doMock('./path')
        else if (dynamicImportMockMethodNames.includes(methodName)) {
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

        if (hoistedMethodNames.includes(methodName)) {
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
            hoistedNodes.add(declarationNode)
          }
          else {
            const awaitedExpression = findNodeAround(
              ast,
              node.start,
              'AwaitExpression',
            )?.node as Positioned<AwaitExpression> | undefined
            // hoist "await vi.hoisted(async () => {})" or "vi.hoisted(() => {})"
            const moveNode = awaitedExpression?.argument === node ? awaitedExpression : node
            hoistedNodes.add(moveNode)
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
      const argument = node.arguments[0] as Positioned<Expression>
      const argStr = argument.type === 'Literal' || argument.type === 'ImportExpression'
        ? code.slice(argument.start, argument.end)
        : ''
      return `${callee.object.name}.${callee.property.name}(${argStr})`
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

  // validate hoistedNodes doesn't have nodes inside other nodes
  const arrayNodes = Array.from(hoistedNodes)
  for (let i = 0; i < arrayNodes.length; i++) {
    const node = arrayNodes[i]
    for (let j = i + 1; j < arrayNodes.length; j++) {
      const otherNode = arrayNodes[j]

      if (node.start >= otherNode.start && node.end <= otherNode.end) {
        throw createError(otherNode, node)
      }
      if (otherNode.start >= node.start && otherNode.end <= node.end) {
        throw createError(node, otherNode)
      }
    }
  }

  // validate that hoisted nodes are defined on the top level
  // ignore `import.meta.vitest` because it needs to be inside an IfStatement
  // and it can be used anywhere in the code (inside methods too)
  if (!hasImportMetaVitest) {
    for (const node of ast.body as Node[]) {
      hoistedNodes.delete(node as any)
      if (node.type === 'ExpressionStatement') {
        hoistedNodes.delete(node.expression as any)
      }
    }

    for (const invalidNode of hoistedNodes) {
      console.warn(
        `Warning: A ${getNodeName(getNodeCall(invalidNode))} call in "${id}" is not at the top level of the module. `
        + `Although it appears nested, it will be hoisted and executed before any tests run. `
        + `Move it to the top level to reflect its actual execution order. This will become an error in a future version.\n`
        + `See: https://vitest.dev/guide/mocking/modules#how-it-works`,
      )
    }
  }

  // hoist vi.mock/vi.hoisted
  for (const node of arrayNodes) {
    const end = getNodeTail(code, node)
    // don't hoist into itself if it's already at the top
    if (hoistIndex === end || hoistIndex === node.start) {
      hoistIndex = end
    }
    else {
      s.move(node.start, end, hoistIndex)
    }
  }

  // hoist actual dynamic imports last so they are inserted after all hoisted mocks
  for (const { node: importNode, id: importId } of imports) {
    const source = importNode.source.value as string

    const sourceString = JSON.stringify(source)
    let importLine = `const ${importId} = await `
    if (options.globalThisAccessor) {
      importLine += `globalThis[${options.globalThisAccessor}].wrapDynamicImport(() => import(${sourceString}));\n`
    }
    else {
      importLine += `import(${sourceString});\n`
    }

    s.update(
      importNode.start,
      importNode.end,
      importLine,
    )

    if (importNode.start === hoistIndex) {
      // no need to hoist, but update hoistIndex to keep the order
      hoistIndex = importNode.end
    }
    else {
      // There will be an error if the module is called before it is imported,
      // so the module import statement is hoisted to the top
      s.move(importNode.start, importNode.end, hoistIndex)
    }
  }

  if (!hoistedModuleImported && arrayNodes.length > 0) {
    const utilityImports = [...usedUtilityExports]
    // "vi" or "vitest" is imported from a module other than "vitest"
    if (utilityImports.some(name => idToImportMap.has(name))) {
      s.appendLeft(hashbangEnd, API_NOT_FOUND_CHECK(utilityImports))
    }
    // if "vi" or "vitest" are not imported at all, import them
    else if (utilityImports.length) {
      s.appendLeft(
        hashbangEnd,
        `import { ${[...usedUtilityExports].join(', ')} } from ${JSON.stringify(
          hoistedModule,
        )}\n`,
      )
    }
  }

  return s
}

interface CodeFrameGenerator {
  (node: Positioned<Node>, id: string, code: string): string
}

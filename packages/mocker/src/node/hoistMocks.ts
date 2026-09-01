import type {
  ArrowFunctionExpression,
  AwaitExpression,
  CallExpression,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  ExportSpecifier,
  Expression,
  FunctionExpression,
  Identifier,
  ImportDeclaration,
  SpreadElement,
  VariableDeclaration,
} from 'estree'
import type { Rollup } from 'vite'
import type { Node, Positioned } from './esmWalker'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { findNodeAround } from 'acorn-walk'
import MagicString from 'magic-string'
import { relative } from 'pathe'
import { esmWalker } from './esmWalker'

export interface StaticMockCall {
  method: string
  specifier: string
  hasFactory: boolean
  /** the factory uses `importOriginal`/`importActual` */
  factoryLoadsOriginal: boolean
}

export interface HoistMocksOptions {
  onStaticMock?: (call: StaticMockCall) => void
  /** Emit a live export getter for an imported binding, before hoisted code runs. */
  renderExport?: (name: string, expression: string) => string
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
  /**
   * Root of the project
   * @default process.cwd()
   */
  root?: string
  getMap?: () => Rollup.SourceMap
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

// Public redistributions of Vitest that re-export its mocking API (`vi`)
// verbatim under their own specifier. Imports from these are treated as the
// hoisted module so `vi.mock()` is hoisted for e.g.
// `import { vi } from 'vite-plus/test'`, exactly as it is for `vitest`.
const REDISTRIBUTED_HOISTED_MODULES = ['vite-plus/test']

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
    // "vi" helpers can access it. Vitest redistributions that re-export the
    // mocking API under their own specifier are recognized the same way.
    if (hoistedModule === source || REDISTRIBUTED_HOISTED_MODULES.includes(source)) {
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
  let hasMockApiCall = false

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
          hasMockApiCall = true
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
          if (options.onStaticMock) {
            const specifier = getStaticSpecifier(node.arguments[0])
            if (specifier != null) {
              // anything but an inline function may still load the original
              const factory = node.arguments[1]?.type === 'ArrowFunctionExpression' || node.arguments[1]?.type === 'FunctionExpression'
                ? node.arguments[1] as Positioned<ArrowFunctionExpression | FunctionExpression>
                : undefined
              options.onStaticMock({
                method: methodName,
                specifier,
                hasFactory: factory != null,
                factoryLoadsOriginal: factory != null
                  && (factory.params.length > 0 || code.slice(factory.start, factory.end).includes('importActual')),
              })
            }
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
          hasMockApiCall = true
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
          hasMockApiCall = true
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

  if (!hasMockApiCall) {
    return
  }

  const { renderExport } = options
  if (renderExport) {
    let exports = ''
    for (const node of ast.body as Node[]) {
      if (node.type !== 'ExportNamedDeclaration' || node.source) {
        continue
      }
      const specifiers = node.specifiers as Positioned<ExportSpecifier>[]
      const removed = new Set(specifiers.filter((specifier) => {
        const binding = idToImportMap.get((specifier.local as Identifier).name)
        if (!binding) {
          return false
        }
        const name = specifier.exported.type === 'Identifier'
          ? specifier.exported.name
          : String(specifier.exported.value)
        exports += renderExport(name, binding)
        return true
      }))
      if (!removed.size) {
        continue
      }
      if (removed.size === specifiers.length) {
        s.remove(node.start, node.end)
        continue
      }
      // Remove adjacent imported specifiers together, including their separator.
      for (let i = 0; i < specifiers.length; i++) {
        if (!removed.has(specifiers[i])) {
          continue
        }
        const start = i
        while (removed.has(specifiers[i + 1])) {
          i++
        }
        const last = i === specifiers.length - 1
        s.remove(
          last ? specifiers[start - 1].end : specifiers[start].start,
          last ? specifiers[i].end : specifiers[i + 1].start,
        )
      }
    }
    s.appendLeft(hashbangEnd, exports)
  }

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

    if (hoistedNodes.size) {
      const locations = createIndexLocationsMap(code)
      const map = options.getMap && new TraceMap(options.getMap() as any)
      const plural = hoistedNodes.size > 1
      const message = [
        `${hoistedNodes.size} call${plural ? 's' : ''} in "${relative(options.root || process.cwd(), id)}" ${plural ? 'were' : 'was'} defined outside of the module's top level scope:`,
        '',
        ...Array.from(hoistedNodes, (invalidNode) => {
          const currentLocation = locations.get(invalidNode.start)
          const originalLocation = map && currentLocation && originalPositionFor(map, currentLocation)
          const location = originalLocation?.column != null && originalLocation?.line != null
            ? ` at ${relative(options.root || process.cwd(), id)}:${originalLocation.line}:${originalLocation.column + 1}`
            : ''
          return `- ${getNodeName(getNodeCall(invalidNode))}${location}`
        }),
        '',
        `Although ${plural ? 'they appear nested, they' : 'it appears nested, it'} will be hoisted and executed before anything in this file. Move ${plural ? 'them' : 'it'} to the top level to reflect ${plural ? 'their' : 'its'} actual execution order.`,
        'See: https://vitest.dev/guide/mocking/modules#how-it-works',
      ].join('\n')
      throw new Error(message)
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

function createIndexLocationsMap(source: string): Map<number, { line: number; column: number }> {
  const map = new Map<number, { line: number; column: number }>()
  let offset = 0
  let line = 1
  let column = 1
  for (const char of source) {
    map.set(offset++, { line, column })
    if (char === '\n' || char === '\r\n') {
      line++
      column = 0
    }
    else {
      column++
    }
  }
  return map
}

function getStaticSpecifier(node: Expression | SpreadElement | undefined): string | undefined {
  if (node?.type === 'AwaitExpression') {
    node = node.argument
  }
  if (node?.type === 'ImportExpression') {
    node = node.source
  }
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return node.value
  }
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked ?? undefined
  }
}

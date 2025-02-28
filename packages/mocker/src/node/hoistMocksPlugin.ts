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
import type { SourceMap } from 'magic-string'
import type { RollupAstNode } from 'rollup'
import type { Plugin, Rollup } from 'vite'
import type { Node, Positioned } from './esmWalker'
import { findNodeAround } from 'acorn-walk'
import MagicString from 'magic-string'
import { createFilter } from 'vite'
import { esmWalker } from './esmWalker'

interface HoistMocksOptions {
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
  regexpHoistable?: RegExp
  codeFrameGenerator?: CodeFrameGenerator
}

export interface HoistMocksPluginOptions extends Omit<HoistMocksOptions, 'regexpHoistable'> {
  include?: string | RegExp | (string | RegExp)[]
  exclude?: string | RegExp | (string | RegExp)[]
  /**
   * overrides include/exclude options
   */
  filter?: (id: string) => boolean
}

export function hoistMocksPlugin(options: HoistMocksPluginOptions = {}): Plugin {
  const filter = options.filter || createFilter(options.include, options.exclude)

  const {
    hoistableMockMethodNames = ['mock', 'unmock'],
    dynamicImportMockMethodNames = ['mock', 'unmock', 'doMock', 'doUnmock'],
    hoistedMethodNames = ['hoisted'],
    utilsObjectNames = ['vi', 'vitest'],
  } = options

  const methods = new Set([
    ...hoistableMockMethodNames,
    ...hoistedMethodNames,
    ...dynamicImportMockMethodNames,
  ])

  const regexpHoistable = new RegExp(
    `\\b(?:${utilsObjectNames.join('|')})\\s*\.\\s*(?:${Array.from(methods).join('|')})\\(`,
  )

  return {
    name: 'vitest:mocks',
    enforce: 'post',
    transform(code, id) {
      if (!filter(id)) {
        return
      }
      return hoistMocks(code, id, this.parse, {
        regexpHoistable,
        hoistableMockMethodNames,
        hoistedMethodNames,
        utilsObjectNames,
        dynamicImportMockMethodNames,
        ...options,
      })
    },
  }
}

const API_NOT_FOUND_ERROR = `There are some problems in resolving the mocks API.
You may encounter this issue when importing the mocks API from another module other than 'vitest'.
To fix this issue you can either:
- import the mocks API directly from 'vitest'
- enable the 'globals' options`

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
  = /\b(?:vi|vitest)\s*\.\s*(?:mock|unmock|hoisted|doMock|doUnmock)\(/
const hashbangRE = /^#!.*\n/

export interface HoistMocksResult {
  ast: Rollup.ProgramNode
  code: string
  map: SourceMap
}

interface CodeFrameGenerator {
  (node: Positioned<Node>, id: string, code: string): string
}

// this is a fork of Vite SSR transform
export function hoistMocks(
  code: string,
  id: string,
  parse: Rollup.PluginContext['parse'],
  options: HoistMocksOptions = {},
): HoistMocksResult | undefined {
  const needHoisting = (options.regexpHoistable || regexpHoistable).test(code)

  if (!needHoisting) {
    return
  }

  const s = new MagicString(code)

  let ast: Rollup.ProgramNode
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
  let hoistIndex = hashbangRE.exec(code)?.[0].length ?? 0

  let hoistedModuleImported = false

  let uid = 0
  const idToImportMap = new Map<string, string>()

  const imports: {
    node: RollupAstNode<ImportDeclaration>
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
  const hoistedNodes: Positioned<
  CallExpression | VariableDeclaration | AwaitExpression
  >[] = []

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
          hoistedNodes.push(node)
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
            hoistedNodes.push(declarationNode)
          }
          else {
            const awaitedExpression = findNodeAround(
              ast,
              node.start,
              'AwaitExpression',
            )?.node as Positioned<AwaitExpression> | undefined
            // hoist "await vi.hoisted(async () => {})" or "vi.hoisted(() => {})"
            const moveNode = awaitedExpression?.argument === node ? awaitedExpression : node
            hoistedNodes.push(moveNode)
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

  // hoist vi.mock/vi.hoisted
  for (const node of hoistedNodes) {
    const end = getNodeTail(code, node)
    if (hoistIndex === end) {
      hoistIndex = end
    }
    // don't hoist into itself if it's already at the top
    else if (hoistIndex !== node.start) {
      s.move(node.start, end, hoistIndex)
    }
  }

  // hoist actual dynamic imports last so they are inserted after all hoisted mocks
  for (const { node: importNode, id: importId } of imports) {
    const source = importNode.source.value as string

    s.update(
      importNode.start,
      importNode.end,
      `const ${importId} = await import(${JSON.stringify(
        source,
      )});\n`,
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

  if (!hoistedModuleImported && hoistedNodes.length) {
    const utilityImports = [...usedUtilityExports]
    // "vi" or "vitest" is imported from a module other than "vitest"
    if (utilityImports.some(name => idToImportMap.has(name))) {
      s.prepend(API_NOT_FOUND_CHECK(utilityImports))
    }
    // if "vi" or "vitest" are not imported at all, import them
    else if (utilityImports.length) {
      s.prepend(
        `import { ${[...usedUtilityExports].join(', ')} } from ${JSON.stringify(
          hoistedModule,
        )}\n`,
      )
    }
  }

  return {
    ast,
    code: s.toString(),
    map: s.generateMap({ hires: 'boundary', source: id }),
  }
}

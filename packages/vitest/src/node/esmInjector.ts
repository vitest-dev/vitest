import { Parser } from 'acorn'
import MagicString from 'magic-string'
import { extract_names as extractNames } from 'periscopic'
import type { CallExpression, Expression, Identifier, ImportDeclaration, VariableDeclaration } from 'estree'
import { findNodeAround, simple as simpleWalk } from 'acorn-walk'
import type { ViteDevServer } from 'vite'
import { toArray } from '../utils'
import type { Node, Positioned } from './esmWalker'
import { esmWalker, isInDestructuringAssignment, isNodeInPattern, isStaticProperty } from './esmWalker'
import type { WorkspaceProject } from './workspace'
import type { Vitest } from './core'

const API_NOT_FOUND_ERROR = `There are some problems in resolving the mocks API.
You may encounter this issue when importing the mocks API from another module other than 'vitest'.
To fix this issue you can either:
- import the mocks API directly from 'vitest'
- enable the 'globals' options`

const API_NOT_FOUND_CHECK = '\nif (typeof globalThis.vi === "undefined" && typeof globalThis.vitest === "undefined") '
+ `{ throw new Error(${JSON.stringify(API_NOT_FOUND_ERROR)}) }\n`

const parsers = new WeakMap<ViteDevServer, typeof Parser>()

function getAcornParser(server: ViteDevServer) {
  let parser = parsers.get(server)!
  if (!parser) {
    const acornPlugins = server.pluginContainer.options.acornInjectPlugins || []
    parser = Parser.extend(...toArray(acornPlugins) as any)
    parsers.set(server, parser)
  }
  return parser
}

function isIdentifier(node: any): node is Positioned<Identifier> {
  return node.type === 'Identifier'
}

function transformImportSpecifiers(node: ImportDeclaration, mode: 'object' | 'named' = 'object') {
  const specifiers = node.specifiers

  if (specifiers.length === 1 && specifiers[0].type === 'ImportNamespaceSpecifier')
    return specifiers[0].local.name

  const dynamicImports = node.specifiers.map((specifier) => {
    if (specifier.type === 'ImportDefaultSpecifier')
      return `default ${mode === 'object' ? ':' : 'as'} ${specifier.local.name}`

    if (specifier.type === 'ImportSpecifier') {
      const local = specifier.local.name
      const imported = specifier.imported.name
      if (local === imported)
        return local
      return `${imported} ${mode === 'object' ? ':' : 'as'} ${local}`
    }

    return null
  }).filter(Boolean).join(', ')

  if (!dynamicImports.length)
    return ''

  return `{ ${dynamicImports} }`
}

const viInjectedKey = '__vi_inject__'
// const viImportMetaKey = '__vi_import_meta__' // to allow overwrite
const viExportAllHelper = '__vi_export_all__'

const regexpHoistable = /^[ \t]*\b(vi|vitest)\s*\.\s*(mock|unmock|hoisted)\(/m

const skipHijack = [
  '/@vite/client',
  '/@vite/env',
  /vite\/dist\/client/,
]

// this is basically copypaste from Vite SSR
export function injectVitestModule(project: WorkspaceProject | Vitest, code: string, id: string) {
  if (skipHijack.some(skip => id.match(skip)))
    return

  const hasMocks = regexpHoistable.test(code)
  const hijackEsm = project.config.slowHijackESM ?? false

  if (!hasMocks && !hijackEsm)
    return

  const s = new MagicString(code)
  const parser = getAcornParser(project.server)

  let ast: any
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      ecmaVersion: 'latest',
      locations: true,
      ranges: true,
    })
  }
  catch (err) {
    console.error(`Cannot parse ${id}:\n${(err as any).message}`)
    return
  }

  let uid = 0
  const idToImportMap = new Map<string, string>()
  const declaredConst = new Set<string>()

  const hoistIndex = 0

  let hasInjected = false
  let hoistedCode = ''
  let hoistedVitestImports = ''

  // this will tranfrom import statements into dynamic ones, if there are imports
  // it will keep the import as is, if we don't need to mock anything
  // in browser environment it will wrap the module value with "vitest_wrap_module" function
  // that returns a proxy to the module so that named exports can be mocked
  const transformImportDeclaration = (node: ImportDeclaration) => {
    // if we don't hijack ESM and process this file, then we definetly have mocks,
    // so we need to transform imports into dynamic ones, so "vi.mock" can be executed before
    if (!hijackEsm) {
      const specifiers = transformImportSpecifiers(node)
      const code = specifiers
        ? `const ${specifiers} = await import('${node.source.value}')\n`
        : `await import('${node.source.value}')\n`
      return { code }
    }

    const importId = `__vi_esm_${uid++}__`
    const hasSpecifiers = node.specifiers.length > 0
    if (hasMocks) {
      const code = hasSpecifiers
        ? `const { ${viInjectedKey}: ${importId} } = await import('${node.source.value}')\n`
        : `await import('${node.source.value}')\n`
      return {
        code,
        id: importId,
      }
    }
    const code = hasSpecifiers
      ? `import { ${viInjectedKey} as ${importId} } from '${node.source.value}'\n`
      : `import '${node.source.value}'\n`
    return {
      code,
      id: importId,
    }
  }

  function defineImport(node: ImportDeclaration) {
    if (node.source.value === 'vitest') {
      const importId = `__vi_esm_${uid++}__`
      const code = hijackEsm
        ? `import { ${viInjectedKey} as ${importId} } from 'vitest'\nconst ${transformImportSpecifiers(node)} = ${importId};\n`
        : `import ${transformImportSpecifiers(node, 'named')} from 'vitest'\n`
      hoistedVitestImports += code
      return
    }
    const { code, id } = transformImportDeclaration(node)
    s.appendLeft(hoistIndex, code)
    return id
  }

  function defineImportAll(source: string) {
    const importId = `__vi_esm_${uid++}__`
    s.appendLeft(hoistIndex, `const { ${viInjectedKey}: ${importId} } = await import(${JSON.stringify(source)});\n`)
    return importId
  }

  function defineExport(position: number, name: string, local = name) {
    hasInjected = true
    s.appendLeft(
      position,
      `\nObject.defineProperty(${viInjectedKey}, "${name}", `
        + `{ enumerable: true, configurable: true, get(){ return ${local} }});`,
    )
  }

  // 1. check all import statements and record id -> importName map
  for (const node of ast.body as Node[]) {
    // import foo from 'foo' --> foo -> __import_foo__.default
    // import { baz } from 'foo' --> baz -> __import_foo__.baz
    // import * as ok from 'foo' --> ok -> __import_foo__
    if (node.type === 'ImportDeclaration') {
      const importId = defineImport(node)
      s.remove(node.start, node.end)
      if (!hijackEsm || !importId)
        continue
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

  // 2. check all export statements and define exports
  for (const node of ast.body as Node[]) {
    if (!hijackEsm)
      break

    // named exports
    if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) {
        if (
          node.declaration.type === 'FunctionDeclaration'
          || node.declaration.type === 'ClassDeclaration'
        ) {
          // export function foo() {}
          defineExport(node.end, node.declaration.id!.name)
        }
        else {
          // export const foo = 1, bar = 2
          for (const declaration of node.declaration.declarations) {
            const names = extractNames(declaration.id as any)
            for (const name of names)
              defineExport(node.end, name)
          }
        }
        s.remove(node.start, (node.declaration as Node).start)
      }
      else {
        s.remove(node.start, node.end)
        if (node.source) {
          // export { foo, bar } from './foo'
          const importId = defineImportAll(node.source.value as string)
          // hoist re-exports near the defined import so they are immediately exported
          for (const spec of node.specifiers) {
            defineExport(
              hoistIndex,
              spec.exported.name,
              `${importId}.${spec.local.name}`,
            )
          }
        }
        else {
          // export { foo, bar }
          for (const spec of node.specifiers) {
            const local = spec.local.name
            const binding = idToImportMap.get(local)
            defineExport(node.end, spec.exported.name, binding || local)
          }
        }
      }
    }

    // default export
    if (node.type === 'ExportDefaultDeclaration') {
      const expressionTypes = ['FunctionExpression', 'ClassExpression']
      if (
        'id' in node.declaration
        && node.declaration.id
        && !expressionTypes.includes(node.declaration.type)
      ) {
        // named hoistable/class exports
        // export default function foo() {}
        // export default class A {}
        hasInjected = true
        const { name } = node.declaration.id
        s.remove(node.start, node.start + 15 /* 'export default '.length */)
        s.append(
          `\nObject.defineProperty(${viInjectedKey}, "default", `
            + `{ enumerable: true, configurable: true, value: ${name} });`,
        )
      }
      else {
        // anonymous default exports
        hasInjected = true
        s.update(
          node.start,
          node.start + 14 /* 'export default'.length */,
          `${viInjectedKey}.default =`,
        )
        if (id.startsWith(project.server.config.cacheDir)) {
          // keep export default for optimized dependencies
          s.append(`\nexport default { ${viInjectedKey}: ${viInjectedKey}.default };\n`)
        }
      }
    }

    // export * from './foo'
    if (node.type === 'ExportAllDeclaration') {
      s.remove(node.start, node.end)
      const importId = defineImportAll(node.source.value as string)
      // hoist re-exports near the defined import so they are immediately exported
      if (node.exported) {
        defineExport(hoistIndex, node.exported.name, `${importId}`)
      }
      else {
        hasInjected = true
        s.appendLeft(hoistIndex, `${viExportAllHelper}(${viInjectedKey}, ${importId});\n`)
      }
    }
  }

  function CallExpression(node: Positioned<CallExpression>) {
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
      && isViHoisted(init))
      || (init
          && init.type === 'AwaitExpression'
          && init.argument.type === 'CallExpression'
          && isViHoisted(init.argument))
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
  }

  if (hijackEsm) {
    // 3. convert references to import bindings & import.meta references
    esmWalker(ast, {
      onCallExpression: CallExpression,
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
        else {
          s.update(id.start, id.end, binding)
        }
      },
      // TODO: make env updatable
      onImportMeta() {
        // s.update(node.start, node.end, viImportMetaKey)
      },
      onDynamicImport(node) {
        const replace = '__vi_wrap_module__(import('
        s.overwrite(node.start, (node.source as Positioned<Expression>).start, replace)
        s.overwrite(node.end - 1, node.end, '))')
      },
    })
  }
  else {
    simpleWalk(ast, {
      CallExpression: CallExpression as any,
    })
  }

  if (hoistedCode || hoistedVitestImports) {
    s.prepend(
      hoistedVitestImports
      + ((!hoistedVitestImports && hoistedCode) ? API_NOT_FOUND_CHECK : '')
      + hoistedCode,
    )
  }

  if (hasInjected) {
    s.prepend(`const ${viInjectedKey} = { [Symbol.toStringTag]: "Module" };\n`)
    s.append(`\nexport { ${viInjectedKey} }`)
  }

  return {
    ast,
    code: s.toString(),
    map: s.generateMap({ hires: true, source: id }),
  }
}

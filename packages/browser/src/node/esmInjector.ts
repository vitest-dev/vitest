import MagicString from 'magic-string'
import { extract_names as extractNames } from 'periscopic'
import type { PluginContext } from 'rollup'
import { esmWalker } from '@vitest/utils/ast'
import type { Expression, ImportDeclaration, Node, Positioned } from '@vitest/utils/ast'

const viInjectedKey = '__vi_inject__'
// const viImportMetaKey = '__vi_import_meta__' // to allow overwrite
const viExportAllHelper = '__vi_export_all__'

const skipHijack = [
  '/@vite/client',
  '/@vite/env',
  /vite\/dist\/client/,
]

// this is basically copypaste from Vite SSR
// this method transforms all import and export statements into `__vi_injected__` variable
// to allow spying on them. this can be disabled by setting `slowHijackESM` to `false`
export function injectVitestModule(code: string, id: string, parse: PluginContext['parse']) {
  if (skipHijack.some(skip => id.match(skip)))
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

  let uid = 0
  const idToImportMap = new Map<string, string>()
  const declaredConst = new Set<string>()

  const hoistIndex = 0

  let hasInjected = false

  // this will transform import statements into dynamic ones, if there are imports
  // it will keep the import as is, if we don't need to mock anything
  // in browser environment it will wrap the module value with "vitest_wrap_module" function
  // that returns a proxy to the module so that named exports can be mocked
  const transformImportDeclaration = (node: ImportDeclaration) => {
    const source = node.source.value as string

    if (skipHijack.some(skip => source.match(skip)))
      return null

    const importId = `__vi_esm_${uid++}__`
    const hasSpecifiers = node.specifiers.length > 0
    const code = hasSpecifiers
      ? `import { ${viInjectedKey} as ${importId} } from '${source}'\n`
      : `import '${source}'\n`
    return {
      code,
      id: importId,
    }
  }

  function defineImport(node: ImportDeclaration) {
    const declaration = transformImportDeclaration(node)
    if (!declaration)
      return null
    s.appendLeft(hoistIndex, declaration.code)
    return declaration.id
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

  // 2. check all export statements and define exports
  for (const node of ast.body as Node[]) {
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
        // keep export default for optimized dependencies
        s.append(`\nexport default { ${viInjectedKey}: ${viInjectedKey}.default };\n`)
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

  // 3. convert references to import bindings & import.meta references
  esmWalker(ast, {
    onIdentifier(id, info, parentStack) {
      const binding = idToImportMap.get(id.name)
      if (!binding)
        return

      if (info.hasBindingShortcut) {
        s.appendLeft(id.end, `: ${binding}`)
      }
      else if (
        info.classDeclaration
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
        !info.classExpression
      ) {
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

  if (hasInjected) {
    // make sure "__vi_injected__" is declared as soon as possible
    s.prepend(`const ${viInjectedKey} = { [Symbol.toStringTag]: "Module" };\n`)
    s.append(`\nexport { ${viInjectedKey} }`)
  }

  return {
    ast,
    code: s.toString(),
    map: s.generateMap({ hires: 'boundary', source: id }),
  }
}

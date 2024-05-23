import type { Declaration, ExportDefaultDeclaration, ExportNamedDeclaration, Expression, Positioned, Program } from '@vitest/utils/ast'
import MagicString from 'magic-string'

export function automockModule(code: string, parse: (code: string) => Program) {
  const ast = parse(code)

  const m = new MagicString(code)

  const allSpecifiers: { name: string; alias?: string }[] = []
  for (const _node of ast.body) {
    if (_node.type === 'ExportAllDeclaration') {
      throw new Error(
        `automocking files with \`export *\` is not supported in browser mode because it cannot be statically analysed`,
      )
    }

    if (_node.type === 'ExportNamedDeclaration') {
      const node = _node as Positioned<ExportNamedDeclaration>
      const declaration = node.declaration // export const name

      if (declaration) {
        if (declaration.type === 'FunctionDeclaration') {
          allSpecifiers.push({ name: declaration.id.name })
        }
        else if (declaration.type === 'VariableDeclaration') {
          declaration.declarations.forEach((declaration) => {
            // TOOD: other types
            if (declaration.id.type === 'Identifier')
              allSpecifiers.push({ name: declaration.id.name })
          })
        }
        else if (declaration.type === 'ClassDeclaration') {
          allSpecifiers.push({ name: declaration.id.name })
        }
        m.remove(node.start, (declaration as Positioned<Declaration>).start)
      }
      // TODO: support export { name, name as name2 }
      // const specifiers = node.specifiers || [] // export { name }
      // const source = node.source // export { name } from './'
    }
    if (_node.type === 'ExportDefaultDeclaration') {
      const node = _node as Positioned<ExportDefaultDeclaration>
      const declaration = node.declaration as Positioned<Expression>
      allSpecifiers.push({ name: 'default', alias: '__vitest_default' })
      m.overwrite(node.start, declaration.start, `const __vitest_default = `)
    }
  }
  const moduleObject = `
const __vitest_es_current_module__ = {
  [globalThis.Symbol.toStringTag]: 'Module',
  __esModule: true,
  ${allSpecifiers.map(({ name, alias }) => `["${alias || name}"]: ${alias || name},`).join('\n  ')}
}
const __vitest_mocked_module__ = __vitest_mocker__.mockObject(__vitest_es_current_module__)
`
  const redeclarations = allSpecifiers.map(({ name, alias }) => {
    if (name === 'default')
      return `export default __vitest_mocked_module__['default']`
    return `
const __vitest_mocked_${alias || name} = __vitest_mocked_module__['${alias || name}']
export { __vitest_mocked_${alias || name} as ${alias || name} }
    `
  }).join('\n')
  m.append(moduleObject + redeclarations)
  return m
}

import type {
  Declaration,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  Expression,
  Identifier,
  Literal,
  Pattern,
  Positioned,
  Program,
} from '@vitest/utils/ast'
import MagicString from 'magic-string'

// TODO: better source map replacement
export function automockModule(code: string, parse: (code: string) => Program) {
  const ast = parse(code)

  const m = new MagicString(code)

  const allSpecifiers: { name: string; alias?: string }[] = []
  let importIndex = 0
  for (const _node of ast.body) {
    if (_node.type === 'ExportAllDeclaration') {
      throw new Error(
        `automocking files with \`export *\` is not supported in browser mode because it cannot be statically analysed`,
      )
    }

    if (_node.type === 'ExportNamedDeclaration') {
      const node = _node as Positioned<ExportNamedDeclaration>
      const declaration = node.declaration // export const name

      function traversePattern(expression: Pattern) {
        // export const test = '1'
        if (expression.type === 'Identifier') {
          allSpecifiers.push({ name: expression.name })
        }
        // export const [test, ...rest] = [1, 2, 3]
        else if (expression.type === 'ArrayPattern') {
          expression.elements.forEach((element) => {
            if (!element) {
              return
            }
            traversePattern(element)
          })
        }
        else if (expression.type === 'ObjectPattern') {
          expression.properties.forEach((property) => {
            // export const { ...rest } = {}
            if (property.type === 'RestElement') {
              traversePattern(property)
            }
            // export const { test, test2: alias } = {}
            else if (property.type === 'Property') {
              traversePattern(property.value)
            }
            else {
              property satisfies never
            }
          })
        }
        else if (expression.type === 'RestElement') {
          traversePattern(expression.argument)
        }
        // const [name[1], name[2]] = []
        // cannot be used in export
        else if (expression.type === 'AssignmentPattern') {
          throw new Error(
            `AssignmentPattern is not supported. Please open a new bug report.`,
          )
        }
        // const test = thing.func()
        // cannot be used in export
        else if (expression.type === 'MemberExpression') {
          throw new Error(
            `MemberExpression is not supported. Please open a new bug report.`,
          )
        }
        else {
          expression satisfies never
        }
      }

      if (declaration) {
        if (declaration.type === 'FunctionDeclaration') {
          allSpecifiers.push({ name: declaration.id.name })
        }
        else if (declaration.type === 'VariableDeclaration') {
          declaration.declarations.forEach((declaration) => {
            traversePattern(declaration.id)
          })
        }
        else if (declaration.type === 'ClassDeclaration') {
          allSpecifiers.push({ name: declaration.id.name })
        }
        else {
          declaration satisfies never
        }
        m.remove(node.start, (declaration as Positioned<Declaration>).start)
      }

      const specifiers = node.specifiers || []
      const source = node.source

      if (!source && specifiers.length) {
        specifiers.forEach((specifier) => {
          const exported = specifier.exported as Literal | Identifier

          allSpecifiers.push({
            alias: exported.type === 'Literal' ? exported.raw! : exported.name,
            name: specifier.local.name,
          })
        })
        m.remove(node.start, node.end)
      }
      else if (source && specifiers.length) {
        const importNames: [string, string][] = []

        specifiers.forEach((specifier) => {
          const importedName = `__vitest_imported_${importIndex++}__`
          const exported = specifier.exported as Literal | Identifier
          importNames.push([specifier.local.name, importedName])
          allSpecifiers.push({
            name: importedName,
            alias: exported.type === 'Literal' ? exported.raw! : exported.name,
          })
        })

        const importString = `import { ${importNames
          .map(([name, alias]) => `${name} as ${alias}`)
          .join(', ')} } from '${source.value}'`

        m.overwrite(node.start, node.end, importString)
      }
    }
    if (_node.type === 'ExportDefaultDeclaration') {
      const node = _node as Positioned<ExportDefaultDeclaration>
      const declaration = node.declaration as Positioned<Expression>
      allSpecifiers.push({ name: '__vitest_default', alias: 'default' })
      m.overwrite(node.start, declaration.start, `const __vitest_default = `)
    }
  }
  const moduleObject = `
const __vitest_es_current_module__ = {
  __esModule: true,
  ${allSpecifiers.map(({ name }) => `["${name}"]: ${name},`).join('\n  ')}
}
const __vitest_mocked_module__ = __vitest_mocker__.mockObject(__vitest_es_current_module__)
`
  const assigning = allSpecifiers
    .map(({ name }, index) => {
      return `const __vitest_mocked_${index}__ = __vitest_mocked_module__["${name}"]`
    })
    .join('\n')

  const redeclarations = allSpecifiers
    .map(({ name, alias }, index) => {
      return `  __vitest_mocked_${index}__ as ${alias || name},`
    })
    .join('\n')
  const specifiersExports = `
export {
${redeclarations}
}
`
  m.append(moduleObject + assigning + specifiersExports)
  return m
}

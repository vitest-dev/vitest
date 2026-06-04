import type { Declaration, ExportAllDeclaration, ExportDefaultDeclaration, ExportNamedDeclaration, Expression, Pattern, Positioned, Program } from './esmWalker'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import MagicString from 'magic-string'
import { getArbitraryModuleIdentifier } from './esmWalker'
import { collectModuleExports, resolveModuleFormat, transformCode } from './parsers'

export interface AutomockOptions {
  /**
   * @default "__vitest_mocker__"
   */
  globalThisAccessor?: string
  id?: string
}

// TODO: better source map replacement
export function automockModule(
  code: string,
  mockType: 'automock' | 'autospy',
  parse: (code: string) => any,
  options: AutomockOptions = {},
): MagicString {
  const globalThisAccessor = options.globalThisAccessor || '"__vitest_mocker__"'
  let ast: Program
  try {
    ast = parse(code) as Program
  }
  catch (cause) {
    if (options.id) {
      throw new Error(`failed to parse ${options.id}`, { cause })
    }
    throw cause
  }

  const m = new MagicString(code)

  const allSpecifiers: { name: string; alias?: string }[] = []
  const replacers: (() => void)[] = []
  let importIndex = 0
  for (const _node of ast.body) {
    if (_node.type === 'ExportAllDeclaration') {
      const node = _node as Positioned<ExportAllDeclaration>
      // TODO: pass it down in the browser mode
      if (!options.id) {
        throw new Error(
          `automocking files with \`export *\` is not supported because it cannot be easily statically analysed`,
        )
      }

      const source = node.source.value
      if (typeof source !== 'string') {
        throw new TypeError(`unknown source type while automocking: ${source}`)
      }

      const moduleUrl = import.meta.resolve(source, pathToFileURL(options.id).toString())
      const modulePath = fileURLToPath(moduleUrl)
      const moduleContent = readFileSync(modulePath, 'utf-8')
      const transformedCode = transformCode(moduleContent, moduleUrl)
      const moduleFormat = resolveModuleFormat(moduleUrl, transformedCode)
      const moduleExports = collectModuleExports(modulePath, transformedCode, moduleFormat || 'module')
      replacers.push(() => {
        const importNames: string[] = []
        moduleExports.forEach((exportName) => {
          const isReexported = allSpecifiers.some(({ name, alias }) => name === exportName || alias === exportName)
          if (!isReexported) {
            importNames.push(exportName)
            allSpecifiers.push({ name: exportName })
          }
        })

        const importString = `import { ${importNames.join(', ')} } from '${source}';`

        m.overwrite(node.start, node.end, importString)
      })
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
          allSpecifiers.push({
            alias: getArbitraryModuleIdentifier(specifier.exported),
            name: getArbitraryModuleIdentifier(specifier.local),
          })
        })
        m.remove(node.start, node.end)
      }
      else if (source && specifiers.length) {
        const importNames: [string, string][] = []

        specifiers.forEach((specifier) => {
          const importedName = `__vitest_imported_${importIndex++}__`
          importNames.push([getArbitraryModuleIdentifier(specifier.local), importedName])
          allSpecifiers.push({
            name: importedName,
            alias: getArbitraryModuleIdentifier(specifier.exported),
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
  replacers.forEach(cb => cb())
  const moduleObject = `
const __vitest_current_es_module__ = {
  __esModule: true,
  ${allSpecifiers.map(({ name }) => `["${name}"]: ${name},`).join('\n  ')}
}
const __vitest_mocked_module__ = globalThis[${globalThisAccessor}].mockObject(__vitest_current_es_module__, "${mockType}")
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

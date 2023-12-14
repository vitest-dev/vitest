import MagicString from 'magic-string'
import type { PluginContext } from 'rollup'
import type { Expression } from 'estree'
import type { Positioned } from './esmWalker'
import { esmWalker } from './esmWalker'

// don't allow mocking vitest itself
// (this *also* changes the position of user code in the getImporter() helper)
const skipImports = [
  '^vitest$',
  '^@vitest/',
]

export async function insertEsmProxy(
  code: string,
  id: string,
  parse: PluginContext['parse'],
) {
  const s = new MagicString(code)

  let ast: any
  try {
    ast = parse(code)
  }
  catch (err) {
    console.error(`Cannot parse ${id}:\n${(err as any).message}`)
    return
  }

  esmWalker(ast, {
    onDynamicImport(node) {
      const expression = (node.source as Positioned<Expression>)
      if (!(expression.type === 'Literal' && typeof expression.value === 'string'))
        // this is a non-string import so vite won't change it anyway
        return

      const value = expression.value as string

      if (skipImports.some(i => value.match(i)))
        return

      const replace = `__vitest_mocker__.wrap(() => import(${JSON.stringify(value)}))`
      s.overwrite(node.start, node.end, replace)
    },
    onIdentifier() {},
    onImportMeta() {},
  })

  return {
    ast,
    code: s.toString(),
    map: s.generateMap({ hires: 'boundary', source: id }),
  }
}

import MagicString from 'magic-string'
import type { PluginContext } from 'rollup'
import type { Expression } from 'estree'
import type { Positioned } from './esmWalker'
import { esmWalker } from './esmWalker'

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
      const replace = '__vitest_mocker__.wrap(() => import('
      s.overwrite(node.start, (node.source as Positioned<Expression>).start, replace)
      s.overwrite(node.end - 1, node.end, '))')
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

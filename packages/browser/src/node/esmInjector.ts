import MagicString from 'magic-string'
import type { PluginContext } from 'rollup'
import { esmWalker } from '@vitest/utils/ast'
import type { Expression, Positioned } from '@vitest/utils/ast'

export function injectDynamicImport(
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

  // 3. convert references to import bindings & import.meta references
  esmWalker(ast, {
    // TODO: make env updatable
    onImportMeta() {
      // s.update(node.start, node.end, viImportMetaKey)
    },
    onDynamicImport(node) {
      const replaceString = '__vitest_browser_runner__.wrapModule(() => import('
      const importSubstring = code.substring(node.start, node.end)
      const hasIgnore = importSubstring.includes('/* @vite-ignore */')
      s.overwrite(
        node.start,
        (node.source as Positioned<Expression>).start,
        replaceString + (hasIgnore ? '/* @vite-ignore */ ' : ''),
      )
      s.overwrite(node.end - 1, node.end, '))')
    },
  })

  return {
    ast,
    code: s.toString(),
    map: s.generateMap({ hires: 'boundary', source: id }),
  }
}

import type { SourceMap } from 'magic-string'
import type { Plugin, Rollup } from 'vite'
import type { Expression, Positioned } from './esmWalker'
import MagicString from 'magic-string'
import { esmWalker } from './esmWalker'

const regexDynamicImport = /import\s*\(/

export interface DynamicImportPluginOptions {
  /**
   * @default `"__vitest_mocker__"`
   */
  globalThisAccessor?: string
  filter?: (id: string) => boolean
}

export function dynamicImportPlugin(options: DynamicImportPluginOptions = {}): Plugin {
  return {
    name: 'vitest:browser:esm-injector',
    enforce: 'post',
    transform(source, id) {
      // TODO: test is not called for static imports
      if (!regexDynamicImport.test(source)) {
        return
      }
      if (options.filter && !options.filter(id)) {
        return
      }
      return injectDynamicImport(source, id, this.parse, options)
    },
  }
}

export interface DynamicImportInjectorResult {
  ast: Rollup.ProgramNode
  code: string
  map: SourceMap
}

export function injectDynamicImport(
  code: string,
  id: string,
  parse: Rollup.PluginContext['parse'],
  options: DynamicImportPluginOptions = {},
): DynamicImportInjectorResult | undefined {
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
      const globalThisAccessor = options.globalThisAccessor || '"__vitest_mocker__"'
      const replaceString = `globalThis[${globalThisAccessor}].wrapDynamicImport(() => import(`
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

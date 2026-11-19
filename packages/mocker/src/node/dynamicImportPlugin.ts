import type { SourceMap } from 'magic-string'
import type { Environment, Plugin, Rollup } from 'vite'
import type { Expression, Positioned } from './esmWalker'
import MagicString from 'magic-string'
import { esmWalker } from './esmWalker'

const regexDynamicImport = /import\s*\(/

export interface DynamicImportPluginOptions {
  /**
   * @default `"__vitest_mocker__"`
   */
  globalThisAccessor?: string
  filter?: (id: string, environment: Environment) => boolean
}

export function dynamicImportPlugin(options: DynamicImportPluginOptions = {}): Plugin {
  return {
    name: 'vitest:browser:esm-injector',
    enforce: 'post',
    transform: {
      order: 'post',
      handler(source, id) {
        // TODO: test is not called for static imports
        if (!regexDynamicImport.test(source)) {
          return
        }
        if (options.filter && !options.filter(id, this.environment)) {
          return
        }
        return injectDynamicImport(source, id, this.parse, options)
      },
    },
  }
}

export interface DynamicImportInjectorResult {
  code: string
  map: SourceMap
}

export function injectDynamicImport(
  code: string,
  id: string,
  parse: Rollup.PluginContext['parse'],
  options: DynamicImportPluginOptions = {},
): DynamicImportInjectorResult | undefined {
  if (code.includes('wrapDynamicImport')) {
    return
  }

  const s = new MagicString(code)

  let ast: ReturnType<Rollup.PluginContext['parse']>
  try {
    ast = parse(code)
  } catch (err) {
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
      const wrapper = `globalThis[${globalThisAccessor}].wrapDynamicImport`
      const source = node.source as Positioned<Expression>
      const importSubstring = code.substring(node.start, node.end)
      const ignore = importSubstring.includes('/* @vite-ignore */') ? '/* @vite-ignore */ ' : ''
      if (
        source.type === 'Literal' ||
        (source.type === 'TemplateLiteral' && !source.expressions.length)
      ) {
        s.overwrite(node.start, source.start, `${wrapper}(async () => import(${ignore}`)
        s.overwrite(node.end - 1, node.end, '))')
        return
      }
      // the mocker resolves a computed specifier before the import,
      // because Vite cannot rewrite it to the URL that a mock is registered with
      const importOptions = code.slice(source.end, node.end - 1)
      s.overwrite(
        node.start,
        source.start,
        `${wrapper}(async (__vi_specifier__) => import(${ignore}__vi_specifier__${importOptions}), `,
      )
      s.overwrite(source.end, node.end, `, ${JSON.stringify(id)})`)
    },
  })

  return {
    code: s.toString(),
    map: s.generateMap({ hires: 'boundary', source: id }),
  }
}

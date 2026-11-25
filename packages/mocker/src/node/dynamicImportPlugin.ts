import type { ImportSpecifier } from 'es-module-lexer'
import type { SourceMap } from 'magic-string'
import type { Environment, Plugin } from 'vite'
import { initSync, parse } from 'es-module-lexer'
import MagicString from 'magic-string'

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
        return injectDynamicImport(source, id, options)
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
  options: DynamicImportPluginOptions = {},
): DynamicImportInjectorResult | undefined {
  if (code.includes('wrapDynamicImport')) {
    return
  }

  initSync()
  let imports: readonly ImportSpecifier[]
  try {
    imports = parse(code, id)[0]
  } catch (err) {
    console.error(`Cannot parse ${id}:\n${(err as any).message}`)
    return
  }

  const globalThisAccessor = options.globalThisAccessor || '"__vitest_mocker__"'
  const wrapper = `globalThis[${globalThisAccessor}].wrapDynamicImport`
  const s = new MagicString(code)
  // the last import goes first, so the options of a computed import
  // are copied after the imports in them are wrapped
  for (const { d, ss, se, s: start, e: end, n } of imports.toReversed()) {
    // -1 is a static import, -2 is `import.meta`
    if (d < 0) {
      continue
    }
    // a string or a template literal without expressions
    if (n !== undefined) {
      s.appendLeft(ss, `${wrapper}(async () => `)
      // the `)` stays with this import if the options of an outer import follow it
      s.appendLeft(se, ')')
      continue
    }
    // the mocker resolves a computed specifier before the import,
    // because Vite cannot rewrite it to the URL that a mock is registered with
    const head = code.slice(ss, start)
    const importOptions = s.slice(end, se - 1)
    s.update(
      ss,
      start,
      `${wrapper}(async (__vi_specifier__) => ${head}__vi_specifier__${importOptions}), `,
    )
    s.overwrite(end, se, `, ${JSON.stringify(id)})`)
  }

  if (!s.hasChanged()) {
    return
  }
  return {
    code: s.toString(),
    map: s.generateMap({ hires: 'boundary', source: id }),
  }
}

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
  const s = new MagicString(code)
  for (const { d, ss, se } of imports) {
    // -1 is a static import, -2 is `import.meta`
    if (d < 0) {
      continue
    }
    s.appendLeft(ss, `globalThis[${globalThisAccessor}].wrapDynamicImport(async () => `)
    s.appendRight(se, ')')
  }

  if (!s.hasChanged()) {
    return
  }
  return {
    code: s.toString(),
    map: s.generateMap({ hires: 'boundary', source: id }),
  }
}

import type { SourceMap } from 'magic-string'
import type { Plugin, Rollup } from 'vite'
import type { HoistMocksOptions, StaticMockCall } from './hoistMocks'
import { createFilter } from 'vite'
import { cleanUrl } from '../utils'
import { hoistMocks } from './hoistMocks'

export interface HoistMocksPluginOptions extends Omit<HoistMocksOptions, 'regexpHoistable'> {
  include?: string | RegExp | (string | RegExp)[]
  exclude?: string | RegExp | (string | RegExp)[]
  /**
   * overrides include/exclude options
   */
  filter?: (id: string) => boolean
}

export function hoistMocksPlugin(options: HoistMocksPluginOptions = {}): Plugin {
  const filter = options.filter || createFilter(options.include, options.exclude)

  const {
    hoistableMockMethodNames = ['mock', 'unmock'],
    dynamicImportMockMethodNames = ['mock', 'unmock', 'doMock', 'doUnmock'],
    hoistedMethodNames = ['hoisted'],
    utilsObjectNames = ['vi', 'vitest'],
  } = options

  const methods = new Set([
    ...hoistableMockMethodNames,
    ...hoistedMethodNames,
    ...dynamicImportMockMethodNames,
  ])

  const regexpHoistable = new RegExp(
    `\\b(?:${utilsObjectNames.join('|')})\\s*\.\\s*(?:${Array.from(methods).join('|')})\\s*\\(`,
  )

  let root = options.root

  return {
    name: 'vitest:mocks',
    enforce: 'post',
    configResolved: options.root === undefined
      ? (config) => { root = config.root }
      : undefined,
    transform(code, id) {
      if (!filter(id)) {
        return
      }
      const staticMocks: StaticMockCall[] = []
      let hoistedExports = ''
      const s = hoistMocks(code, id, this.parse, {
        regexpHoistable,
        hoistableMockMethodNames,
        hoistedMethodNames,
        utilsObjectNames,
        dynamicImportMockMethodNames,
        root,
        getMap: () => this.getCombinedSourcemap(),
        ...options,
        renderExport: options.renderExport && ((name, expression) => {
          hoistedExports += options.renderExport!(name, expression)
          return ''
        }),
        onStaticMock(call) {
          staticMocks.push(call)
          options.onStaticMock?.(call)
        },
      })
      // vite keeps `meta` across re-transforms, so always reset it
      if (!s) {
        return { meta: { vitestStaticMocks: null, vitestHoistedExports: null } }
      }
      return {
        code: s.toString(),
        map: s.generateMap({ hires: 'boundary', source: cleanUrl(id) }),
        meta: { vitestStaticMocks: staticMocks, vitestHoistedExports: hoistedExports || null },
      }
    },
  }
}

// to keeb backwards compat
export function hoistMockAndResolve(
  code: string,
  id: string,
  parse: Rollup.PluginContext['parse'],
  options: HoistMocksOptions = {},
): HoistMocksResult | undefined {
  const s = hoistMocks(code, id, parse, options)
  if (s) {
    return {
      code: s.toString(),
      map: s.generateMap({ hires: 'boundary', source: cleanUrl(id) }),
    }
  }
}

export interface HoistMocksResult {
  code: string
  map: SourceMap
}

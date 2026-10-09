import type { DevEnvironment, Plugin } from 'vite'
import { init as initModuleLexer, parse as parseModuleSyntax } from 'es-module-lexer'
import { createManualModuleSource } from '../utils'

export interface ManualMockPluginOptions {
  /**
   * @default "__vitest_mocker__"
   */
  globalThisAccessor?: string
}

// serves `<module>?mock=manual&url=<mock url>`: a module that exports every
// name of the original and reads the values from the factory when it evaluates
export function manualMockPlugin(options: ManualMockPluginOptions = {}): Plugin {
  return {
    name: 'vitest:manual-mock',
    enforce: 'pre',
    load: {
      order: 'pre',
      async handler(id) {
        const url = getManualMockUrl(id)
        if (url == null || this.environment.mode !== 'dev') {
          return
        }
        const exports = await collectExports(this.environment, url, new Set())
        return createManualModuleSource(
          url,
          exports,
          options.globalThisAccessor,
          'resolveFactoryModule',
        )
      },
    },
  }
}

function getManualMockUrl(id: string): string | null {
  const queryIndex = id.indexOf('?')
  if (queryIndex === -1) {
    return null
  }
  const query = new URLSearchParams(id.slice(queryIndex + 1))
  if (query.get('mock') !== 'manual') {
    return null
  }
  return query.get('url')
}

async function collectExports(
  environment: DevEnvironment,
  url: string,
  seen: Set<string>,
): Promise<string[]> {
  if (seen.has(url)) {
    return []
  }
  seen.add(url)
  let result: Awaited<ReturnType<DevEnvironment['transformRequest']>>
  try {
    result = await environment.transformRequest(url)
  } catch (cause) {
    throw new Error(`[vitest] Cannot collect the exports of "${url}" for its factory mock`, {
      cause,
    })
  }
  if (!result) {
    throw new Error(`[vitest] Cannot collect the exports of "${url}" for its factory mock`)
  }
  await initModuleLexer
  const [imports, exports] = parseModuleSyntax(result.code, url)
  const reexports = imports.filter(({ ss, se, n }) => {
    const statement = result.code.slice(ss, se).replace(/\s+/g, ' ')
    return n && statement.startsWith('export *') && !statement.startsWith('export * as')
  })
  const names = await Promise.all(reexports.map(({ n }) => collectExports(environment, n!, seen)))
  return Array.from(new Set([...exports.map((entry) => entry.n), ...names.flat()]))
}

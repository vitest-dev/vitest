import type { DevEnvironment, Plugin, TransformResult } from 'vite'
import { init as initModuleLexer, parse as parseModuleSyntax } from 'es-module-lexer'
import { createManualModuleSource } from '../utils'

export interface ManualMockPluginOptions {
  /**
   * @default "__vitest_mocker__"
   */
  globalThisAccessor?: string
  /**
   * Export names for a factory mock whose original module cannot be transformed,
   * read from the factory result of the last registered mock.
   */
  resolveFactoryExports?: (url: string) => Promise<string[]>
}

const PREFIX = '\0vitest-mock:'

// the shim id carries the registry url and the module id, but not the module
// path, so plugins that guard the original by its path never see the shim
export function getManualMockId(url: string, moduleId: string): string {
  const encoded = Buffer.from(JSON.stringify({ url, id: moduleId })).toString('base64url')
  return `${PREFIX}${encoded}`
}

export function getManualMockUrl(url: string, moduleId: string): string {
  return `/@id/__x00__${getManualMockId(url, moduleId).slice(1)}`
}

// serves the shim of a factory mock: a module that exports every name of the
// original and reads the values from the factory when it evaluates
export function manualMockPlugin(options: ManualMockPluginOptions = {}): Plugin {
  return {
    name: 'vitest:manual-mock',
    enforce: 'pre',
    resolveId(id) {
      if (id.startsWith(PREFIX)) {
        return id
      }
    },
    load: {
      order: 'pre',
      async handler(id) {
        if (!id.startsWith(PREFIX) || this.environment.mode !== 'dev') {
          return
        }
        const { url, moduleId } = parseManualMockId(id)
        let exports: string[]
        try {
          exports = await collectEnvironmentExports(this.environment, moduleId)
        } catch (error) {
          // the original cannot be transformed, so the factory result decides
          if (!options.resolveFactoryExports) {
            throw error
          }
          exports = await options.resolveFactoryExports(url)
        }
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

function parseManualMockId(id: string): { url: string; moduleId: string } {
  const encoded = id.slice(PREFIX.length)
  const { url, id: moduleId } = JSON.parse(Buffer.from(encoded, 'base64url').toString())
  return { url, moduleId }
}

export function collectEnvironmentExports(
  environment: DevEnvironment,
  moduleId: string,
  seen: Set<string> = new Set(),
): Promise<string[]> {
  return collectExports(environment, moduleId, seen)
}

// import analysis rewrites re-export sources into browser urls, which
// `transformRequest` does not accept for virtual ids
function unwrapId(url: string): string {
  return url.startsWith('/@id/') ? url.slice(5).replace('__x00__', '\0') : url
}

async function collectExports(
  environment: DevEnvironment,
  moduleId: string,
  seen: Set<string>,
): Promise<string[]> {
  if (seen.has(moduleId)) {
    return []
  }
  seen.add(moduleId)
  let result: TransformResult | null
  try {
    result = await environment.transformRequest(moduleId)
  } catch (cause) {
    throw new Error(
      `[vitest] Cannot collect the exports of "${moduleId}" for its factory mock: ${(cause as Error).message}`,
      { cause },
    )
  }
  if (!result) {
    throw new Error(`[vitest] Cannot collect the exports of "${moduleId}" for its factory mock`)
  }
  await initModuleLexer
  const [imports, exports] = parseModuleSyntax(result.code, moduleId)
  const reexports = imports.filter(({ ss, se, n }) => {
    const statement = result.code.slice(ss, se).replace(/\s+/g, ' ')
    return n && statement.startsWith('export *') && !statement.startsWith('export * as')
  })
  const names = await Promise.all(
    reexports.map(({ n }) => collectExports(environment, unwrapId(n!), seen)),
  )
  return Array.from(new Set([...exports.map((entry) => entry.n), ...names.flat()]))
}

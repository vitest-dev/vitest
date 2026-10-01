import type { StaticMockCall } from '@vitest/mocker/node'
import type { DevEnvironment, TransformResult } from 'vite'
import type { ResolvedConfig } from '../types/config'
import { findMockRedirect } from '@vitest/mocker/node'
import { cleanUrl } from '@vitest/utils/helpers'
import { isAbsolute } from 'pathe'

export interface StaticMockedModules {
  /** Resolved ids of modules that a mock replaces, so they are never loaded. */
  replaced: Set<string>
  /** Files in `__mocks__` that can be loaded instead of the original module. */
  redirects: string[]
}

export function getStaticMocks(
  environment: DevEnvironment,
  id: string,
  transformResult?: TransformResult | null,
): StaticMockCall[] | null | undefined {
  return (
    transformResult?.__vitestStaticMocks ??
    environment.pluginContainer.getModuleInfo(id)?.meta?.vitestStaticMocks
  )
}

/**
 * Resolves the hoisted `vi.mock` calls of `importer`.
 */
export async function resolveStaticMocks(
  environment: DevEnvironment,
  config: ResolvedConfig,
  importer: string,
  mocks: StaticMockCall[] | null | undefined,
): Promise<StaticMockedModules> {
  const result: StaticMockedModules = { replaced: new Set(), redirects: [] }
  const hoisted = mocks?.filter((mock) => mock.method === 'mock')
  if (!hoisted?.length) {
    return result
  }
  await Promise.all(
    hoisted.map(async (mock) => {
      const resolved = await environment.pluginContainer
        .resolveId(mock.specifier, importer)
        .catch(() => null)
      if (mock.hasFactory) {
        if (resolved && !mock.factoryLoadsOriginal) {
          result.replaced.add(resolved.id)
        }
        return
      }
      // without a factory the mock is either redirected to `__mocks__` or
      // generated from the original; options like `{ spy: true }` always use the original
      const redirect = findRedirect(config, mock.specifier, resolved?.id)
      if (redirect) {
        result.redirects.push(redirect)
        if (resolved && mock.automock) {
          result.replaced.add(resolved.id)
        }
      }
    }),
  )
  return result
}

// mirrors how the module mocker picks the `__mocks__` file
function findRedirect(
  config: ResolvedConfig,
  specifier: string,
  resolvedId: string | undefined,
): string | null {
  const id = resolvedId ?? specifier
  const moduleDirectories = config.deps.moduleDirectories ?? ['/node_modules/']
  const external =
    !isAbsolute(id) || moduleDirectories.some((dir) => id.includes(dir)) ? specifier : null
  return findMockRedirect(config.root, cleanUrl(id), external)
}

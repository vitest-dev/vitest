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
  /** Resolved ids of modules that are loaded even if they are mocked, for example, in a setup file. */
  restored: Set<string>
}

const restoringMethods = new Set(['unmock', 'doUnmock', 'importActual'])

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
 * Resolves the static `vi.mock` calls of `importer` and the calls that load the original module.
 */
export async function resolveStaticMocks(
  environment: DevEnvironment,
  config: ResolvedConfig,
  importer: string,
  mocks: StaticMockCall[] | null | undefined,
): Promise<StaticMockedModules> {
  const result: StaticMockedModules = { replaced: new Set(), redirects: [], restored: new Set() }
  if (!mocks?.length) {
    return result
  }
  const resolvedIds = await Promise.all(
    mocks.map(async (mock) => {
      const resolved = await environment.pluginContainer
        .resolveId(mock.specifier, importer)
        .catch(() => null)
      return resolved?.id
    }),
  )
  mocks.forEach((mock, index) => {
    const id = resolvedIds[index]
    if (id && restoringMethods.has(mock.method)) {
      result.restored.add(id)
    }
  })
  mocks.forEach((mock, index) => {
    if (mock.method !== 'mock') {
      return
    }
    const id = resolvedIds[index]
    const replaces = id != null && !result.restored.has(id)
    if (mock.hasFactory) {
      if (replaces && !mock.factoryLoadsOriginal) {
        result.replaced.add(id)
      }
      return
    }
    // without a factory the mock is either redirected to `__mocks__` or
    // generated from the original; options like `{ spy: true }` always use the original
    const redirect = findRedirect(config, mock.specifier, id)
    if (redirect) {
      result.redirects.push(redirect)
      if (replaces && mock.automock) {
        result.replaced.add(id)
      }
    }
  })
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

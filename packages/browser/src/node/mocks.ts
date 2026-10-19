import type { MockedModuleSerialized, MockerRegistry } from '@vitest/mocker'
import type { StaticMockCall } from '@vitest/mocker/node'
import type { TransformResult, ViteDevServer } from 'vite'
import type { TestProject } from 'vitest/node'
import type { MockImportMap, WebSocketBrowserHandlers, WebSocketBrowserRPC } from '../types'
import type { BrowserServerState } from './state'
import {
  AutomockedModule,
  AutospiedModule,
  ManualMockedModule,
  RedirectedModule,
} from '@vitest/mocker'
import { getManualMockId, getManualMockUrl, ServerMockResolver } from '@vitest/mocker/node'
import { join } from 'pathe'
import { slash } from './utils'

export interface FactoryExportResolver {
  sessionId: string
  resolve: () => Promise<string[]>
}

type MockHandlers = Pick<
  WebSocketBrowserHandlers,
  'resolveId' | 'resolveMock' | 'invalidate' | 'registerMock' | 'unregisterMock' | 'clearMocks'
>

export function createMockHandlers(
  project: TestProject,
  {
    registry,
    factoryExportResolvers,
    checkFileAccess,
    rpc,
  }: {
    registry: MockerRegistry
    factoryExportResolvers: Map<string, FactoryExportResolver>
    checkFileAccess: (path: string) => void
    // the tester connection is created after its handlers
    rpc: () => WebSocketBrowserRPC
  },
): MockHandlers {
  const vite = project.vite
  const mockResolver = new ServerMockResolver(vite, {
    moduleDirectories: project.config?.deps?.moduleDirectories,
  })
  const mocker = project.browser?.provider?.mocker

  return {
    resolveId(id, importer) {
      return mockResolver.resolveId(id, importer)
    },
    resolveMock(rawId, importer, options) {
      return mockResolver.resolveMock(rawId, importer, options)
    },
    invalidate(ids) {
      return mockResolver.invalidate(ids)
    },
    async registerMock(
      sessionId,
      module,
      { importer, testFile },
    ): Promise<MockImportMap | undefined> {
      const option = project.config.browser.importMapMocks
      const state = project.browser!.state as BrowserServerState
      if (option === true && state.lateImportMaps === false) {
        throw new Error(
          '"browser.importMapMocks" is enabled, but this browser does not accept an import map after a module has loaded. ' +
            'Firefox needs the "dom.multiple_import_maps.enabled" preference.',
        )
      }
      if (state.usesImportMaps(project.config)) {
        // a rule cannot be removed later, so a mock from another module, like
        // a setup file, is not added when the test file restores the module
        if (
          testFile &&
          importer !== testFile &&
          (await getStaticUnmocks(vite, mockResolver, testFile)).has(module.id)
        ) {
          return
        }
        if (module.type !== 'manual') {
          return resolveMockImportMap(vite, module)
        }
        // the shim reads the original only when it loads; until then the
        // server keeps a way to ask this session for the factory keys
        // this is a last resort check only if the transformation failed
        factoryExportResolvers.set(module.url, {
          sessionId,
          async resolve() {
            const { keys } = await rpc().resolveManualMock(module.url)
            return keys
          },
        })
        // the shim is not tied to the original file, so a changed original
        // would otherwise keep a stale export list
        const { moduleGraph } = vite.environments.client
        const shim = moduleGraph.getModuleById(getManualMockId(module.url, module.id))
        if (shim) {
          moduleGraph.invalidateModule(shim)
        }
        return resolveMockImportMap(vite, module)
      }
      if (!mocker) {
        // make sure modules are not processed yet in case they were imported before
        // and were not mocked
        mockResolver.invalidate([module.id])

        if (module.type === 'manual') {
          const mock = ManualMockedModule.fromJSON(module, async () => {
            try {
              const { keys } = await rpc().resolveManualMock(module.url)
              return Object.fromEntries(keys.map((key) => [key, null]))
            } catch (err) {
              project.vitest.state.catchError(err, 'Manual Mock Resolver Error')
              return {}
            }
          })
          registry.add(mock)
        } else {
          if (module.type === 'redirect') {
            const redirectUrl = new URL(module.redirect)
            const redirect = join(vite.config.root, slash(decodeURI(redirectUrl.pathname)))
            checkFileAccess(redirect)
            module.redirect = redirect
          }
          registry.register(module)
        }
        return
      }

      if (module.type === 'manual') {
        const manualModule = ManualMockedModule.fromJSON(module, async () => {
          const { keys } = await rpc().resolveManualMock(module.url)
          return Object.fromEntries(keys.map((key) => [key, null]))
        })
        await mocker.register(sessionId, manualModule)
      } else if (module.type === 'redirect') {
        await mocker.register(sessionId, RedirectedModule.fromJSON(module))
      } else if (module.type === 'automock') {
        await mocker.register(sessionId, AutomockedModule.fromJSON(module))
      } else if (module.type === 'autospy') {
        await mocker.register(sessionId, AutospiedModule.fromJSON(module))
      }
    },
    clearMocks(sessionId) {
      for (const [url, resolver] of factoryExportResolvers) {
        if (resolver.sessionId === sessionId) {
          factoryExportResolvers.delete(url)
        }
      }
      if (!mocker) {
        return registry.clear()
      }
      return mocker.clear(sessionId)
    },
    unregisterMock(sessionId, id) {
      if (!mocker) {
        return registry.delete(id)
      }
      return mocker.delete(sessionId, id)
    },
  }
}

function injectQuery(url: string, query: string): string {
  return url.includes('?') ? `${url}&${query}` : `${url}?${query}`
}

// the key must be the exact URL that import analysis emits in the browser,
// including the dependency version and the HMR timestamp
function resolveMockImportMap(vite: ViteDevServer, module: MockedModuleSerialized): MockImportMap {
  let url = module.url
  const version = /[?&]v=(\w{8})/.exec(module.id)?.[1]
  if (version) {
    url = injectQuery(url, `v=${version}`)
  }
  const node = vite.environments.client.moduleGraph.getModuleById(module.id)
  if (node && node.lastHMRTimestamp > 0) {
    url = injectQuery(url, `t=${node.lastHMRTimestamp}`)
  }
  const base = vite.config.base.replace(/\/$/, '')
  const key = base + url
  if (module.type === 'redirect') {
    const redirect = new URL(module.redirect)
    return { imports: { [key]: base + redirect.pathname + redirect.search } }
  }
  if (module.type === 'manual') {
    return { imports: { [key]: base + getManualMockUrl(module.url, module.id) } }
  }
  return { imports: { [key]: injectQuery(key, `mock=${module.type}`) } }
}

const staticUnmocks = new WeakMap<TransformResult, Promise<Set<string>>>()

// resolved ids of the modules that a test file restores with a static `vi.unmock` call
async function getStaticUnmocks(
  vite: ViteDevServer,
  resolver: ServerMockResolver,
  testFile: string,
): Promise<Set<string>> {
  const environment = vite.environments.client
  // the url the tester requests, so the transform is shared with the import
  const url = /^\w:/.test(testFile) ? `/@fs/${testFile}` : testFile
  // a test file that fails to transform reports the error when it is imported
  const transformed = await environment.transformRequest(url).catch(() => null)
  const id = (await environment.moduleGraph.getModuleByUrl(url))?.id
  if (!transformed || !id) {
    return new Set()
  }
  let unmocks = staticUnmocks.get(transformed)
  if (!unmocks) {
    const calls: StaticMockCall[] =
      environment.pluginContainer.getModuleInfo(id)?.meta?.vitestStaticMocks ?? []
    unmocks = Promise.all(
      calls
        .filter((call) => call.method === 'unmock')
        .map((call) => resolver.resolveId(call.specifier, id).catch(() => null)),
    ).then((results) => new Set(results.flatMap((resolved) => (resolved ? [resolved.id] : []))))
    staticUnmocks.set(transformed, unmocks)
  }
  return unmocks
}

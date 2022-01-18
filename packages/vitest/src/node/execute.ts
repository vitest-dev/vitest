import { ViteNodeRunner } from 'vite-node/client'
import { toFilePath } from 'vite-node/utils'
import type { ViteNodeRunnerOptions } from 'vite-node'
import type { SuiteMocks } from './mocker'
import { createMocker } from './mocker'

export interface ExecuteOptions extends ViteNodeRunnerOptions {
  files: string[]
  mockMap: SuiteMocks
}

export async function executeInViteNode(options: ExecuteOptions) {
  const runner = new VitestRunner(options)

  const result: any[] = []
  for (const file of options.files)
    result.push(await runner.executeFile(file))

  return result
}

export class VitestRunner extends ViteNodeRunner {
  mocker: ReturnType<typeof createMocker>

  constructor(public options: ExecuteOptions) {
    super(options)

    options.requestStubs = options.requestStubs || {
      '/@vite/client': {
        injectQuery: (id: string) => id,
        createHotContext() {
          return {
            accept: () => {},
            prune: () => {},
          }
        },
        updateStyle() {},
      },
    }

    this.mocker = createMocker(this.root, options.mockMap)
  }

  prepareContext(context: Record<string, any>) {
    const request = context.__vite_ssr_import__

    const callFunctionMock = async(dep: string, mock: () => any) => {
      const cacheName = `${dep}__mock`
      const cached = this.moduleCache.get(cacheName)?.exports
      if (cached)
        return cached
      const exports = await mock()
      this.setCache(cacheName, { exports })
      return exports
    }

    const requestWithMock = async(dep: string) => {
      const mock = this.mocker.getDependencyMock(dep)
      if (mock === null) {
        const cacheName = `${dep}__mock`
        const cache = this.moduleCache.get(cacheName)
        if (cache?.exports)
          return cache.exports
        const cacheKey = toFilePath(dep, this.root)
        const mod = this.moduleCache.get(cacheKey)?.exports || await request(dep)
        const exports = this.mocker.mockObject(mod)
        this.setCache(cacheName, { exports })
        return exports
      }
      if (typeof mock === 'function')
        return callFunctionMock(dep, mock)
      if (typeof mock === 'string')
        dep = mock
      return request(dep)
    }
    const importActual = (path: string, external: string | null) => {
      return request(this.mocker.getActualPath(path, external))
    }
    const importMock = async(path: string, external: string | null): Promise<any> => {
      let mock = this.mocker.getDependencyMock(path)

      if (mock === undefined)
        mock = this.mocker.resolveMockPath(path, this.root, external)

      if (mock === null) {
        const fsPath = this.mocker.getActualPath(path, external)
        const mod = await request(fsPath)
        return this.mocker.mockObject(mod)
      }
      if (typeof mock === 'function')
        return callFunctionMock(path, mock)
      return requestWithMock(mock)
    }

    return Object.assign(context, {
      __vite_ssr_import__: requestWithMock,
      __vite_ssr_dynamic_import__: requestWithMock,

      // vitest.mock API
      __vitest__mock__: this.mocker.mockPath,
      __vitest__unmock__: this.mocker.unmockPath,
      __vitest__importActual__: importActual,
      __vitest__importMock__: importMock,
      // spies from 'jest-mock' are different inside suites and execute,
      // so wee need to call this twice - inside suite and here
      __vitest__clearMocks__: this.mocker.clearMocks,
    })
  }
}

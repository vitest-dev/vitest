import { ViteNodeRunner } from 'vite-node/client'
import { toFilePath } from 'vite-node/utils'
import type { ViteNodeRunnerOptions } from 'vite-node'
import type { SuiteMocks } from './mocker'
import { VitestMocker } from './mocker'

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
  mocker: VitestMocker

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

    this.mocker = new VitestMocker(this.root, options.mockMap)
  }

  prepareContext(context: Record<string, any>) {
    const request = context.__vite_ssr_import__

    const resolvePath = async(id: string, importer: string) => {
      const path = await this.options.resolveId(id, importer)
      return {
        path: path?.id || id,
        external: path?.id.includes('/node_modules/') ? id : null,
      }
    }

    const resolveMocks = async() => {
      await Promise.all(this.mocker.pendingIds.map(async(mock) => {
        const { path, external } = await resolvePath(mock.id, mock.importer)
        if (mock.type === 'unmock')
          this.mocker.unmockPath(path, external)
        if (mock.type === 'mock')
          this.mocker.mockPath(path, external, mock.factory)
      }))

      this.mocker.pendingIds = []
    }

    const callFunctionMock = async(dep: string, mock: () => any) => {
      const cacheName = `${dep}__mock`
      const cached = this.moduleCache.get(cacheName)?.exports
      if (cached)
        return cached
      this.mocker.processingDep = dep
      const exports = await mock()
      this.mocker.processingDep = null
      this.setCache(cacheName, { exports })
      return exports
    }

    const requestWithMock = async(dep: string) => {
      await resolveMocks()
      if (this.mocker.processingDep === dep)
        return request(dep)

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
    const importActual = async(id: string, importer: string) => {
      const { path, external } = await resolvePath(id, importer)
      const fsPath = this.mocker.getActualPath(path, external)
      return request(fsPath)
    }
    const importMock = async(id: string, importer: string): Promise<any> => {
      const { path, external } = await resolvePath(id, importer)

      let mock = this.mocker.getDependencyMock(path)

      if (mock === undefined)
        mock = this.mocker.resolveMockPath(path, external)

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
      __vitest_mock__: this.mocker.queueMock.bind(this.mocker),
      __vitest_unmock__: this.mocker.queueUnmock.bind(this.mocker),
      __vitest_importActual__: importActual,
      __vitest_importMock__: importMock,
      // spies from 'jest-mock' are different inside suites and execute,
      // so wee need to call this twice - inside suite and here
      __vitest_clearMocks__: this.mocker.clearMocks.bind(this.mocker),
    })
  }
}

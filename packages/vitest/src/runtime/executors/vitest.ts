import { isNodeBuiltin } from 'mlly'
import { normalize } from 'pathe'
import type { ModuleCache, ViteNodeRunnerOptions } from 'vite-node'
import { ViteNodeRunner } from 'vite-node/client'
import { isInternalRequest } from 'vite-node/utils'
import type { ResolvedConfig } from '../../types'
import type { MockMap } from '../../types/mocker'
import { getCurrentEnvironment, getWorkerState } from '../../utils/global'
import { VitestMocker } from '../mocker'
import { rpc } from '../rpc'

export interface ExecuteOptions extends Pick<ViteNodeRunnerOptions, 'moduleCache'> {
  mockMap: MockMap
}

export class VitestExecutor extends ViteNodeRunner {
  public mocker: VitestMocker

  constructor(config: ResolvedConfig, options: ExecuteOptions) {
    super({
      fetchModule: (id) => {
        return rpc().fetch(id)
      },
      resolveId: async (id, importer) => {
        try {
          return await rpc().resolveId(id, importer)
        }
        catch (err) {
          const runtimeError = new Error(err.message)
          // original stack refers to the server part, and doesn't have information where the error happened
          // TODO: stacktrace is broken, example on timers.test.ts
          throw runtimeError
        }
      },
      moduleCache: options.moduleCache,
      interopDefault: config.deps.interopDefault,
      root: config.root,
      base: config.base,
    })

    this.mocker = new VitestMocker(this, options.mockMap)

    Object.defineProperty(globalThis, '__vitest_mocker__', {
      value: this.mocker,
      writable: true,
      configurable: true,
    })
  }

  shouldResolveId(id: string, _importee?: string | undefined): boolean {
    if (isInternalRequest(id))
      return false
    const environment = getCurrentEnvironment()
    // do not try and resolve node builtins in Node
    // import('url') returns Node internal even if 'url' package is installed
    return environment === 'node' ? !isNodeBuiltin(id) : !id.startsWith('node:')
  }

  async resolveUrl(id: string, importee?: string) {
    if (importee && importee.startsWith('mock:'))
      importee = importee.slice(5)
    return super.resolveUrl(id, importee)
  }

  async dependencyRequest(id: string, fsPath: string, callstack: string[]): Promise<any> {
    const mocked = await this.mocker.requestWithMock(fsPath, callstack)

    if (typeof mocked === 'string')
      return super.dependencyRequest(mocked, mocked, callstack)
    if (mocked && typeof mocked === 'object')
      return mocked
    return super.dependencyRequest(id, fsPath, callstack)
  }

  prepareContext(mod: ModuleCache, context: Record<string, any>) {
    const workerState = getWorkerState()

    // support `import.meta.vitest` for test entry
    if (workerState.filepath && normalize(workerState.filepath) === normalize(context.__filename)) {
      // @ts-expect-error injected untyped global
      Object.defineProperty(context.__vite_ssr_import_meta__, 'vitest', { get: () => globalThis.__vitest_index__ })
    }

    return context
  }
}

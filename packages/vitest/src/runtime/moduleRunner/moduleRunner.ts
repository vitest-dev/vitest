import type vm from 'node:vm'
import type { HotPayload } from 'vite'
import type { EvaluatedModuleNode, EvaluatedModules, FetchFunction, SSRImportMetadata } from 'vite/module-runner'
import type { WorkerGlobalState } from '../../types/worker'
import type { ExternalModulesExecutor } from '../external-executor'
import { ModuleRunner } from 'vite/module-runner'
import { VitestModuleEvaluator } from './moduleEvaluator'
import { VitestMocker } from './moduleMocker'

// @ts-expect-error overriding private method
export class VitestModuleRunner extends ModuleRunner {
  public mocker: VitestMocker

  constructor(options: VitestModuleRunnerOptions) {
    const transport = new VitestTransport(options.transport)
    super(
      {
        transport,
        hmr: false,
        evaluatedModules: options.getWorkerState().evaluatedModules,
      },
      new VitestModuleEvaluator(
        options.vm,
        {
          get interopDefault() {
            return options.getWorkerState().config.deps.interopDefault
          },
          getCurrentTestFilepath() {
            return options.getWorkerState().filepath
          },
        },
      ),
    )
    this.mocker = new VitestMocker(this, {
      resolveId: options.transport.resolveId,
      get root() {
        return options.getWorkerState().config.root
      },
      get moduleDirectories() {
        return options.getWorkerState().config.deps.moduleDirectories || []
      },
      getCurrentTestFilepath() {
        return options.getWorkerState().filepath
      },
    })

    if (options.vm) {
      options.vm.context.__vitest_mocker__ = this.mocker
    }
    else {
      Object.defineProperty(globalThis, '__vitest_mocker__', {
        configurable: true,
        writable: true,
        value: this.mocker,
      })
    }
  }

  public async fetchModule(url: string, importer?: string): Promise<EvaluatedModuleNode> {
    const module = await (this as any).cachedModule(url, importer)
    return module
  }

  // TODO: remove before release
  /** @deprecated use `import` instead */
  executeId(id: string): Promise<any> {
    return this.import(id)
  }

  private _cachedRequest(
    url: string,
    mod: EvaluatedModuleNode,
    callstack: string[] = [],
    metadata?: SSRImportMetadata,
  ) {
    // @ts-expect-error "cachedRequest" is private
    return super.cachedRequest(url, mod, callstack, metadata)
  }

  /**
   * @internal
   */
  public async cachedRequest(
    url: string,
    mod: EvaluatedModuleNode,
    callstack: string[] = [],
    metadata?: SSRImportMetadata,
    ignoreMock = false,
  ): Promise<any> {
    // console.log('request', { url, ignoreMock })
    if (ignoreMock) {
      return this._cachedRequest(url, mod, callstack, metadata)
    }

    if (VitestMocker.pendingIds.length) {
      await this.mocker.resolveMocks()
    }

    const mocked = await this.mocker.requestWithMock(url, mod, callstack)

    if (typeof mocked === 'string') {
      const node = await this.fetchModule(mocked)
      return this._cachedRequest(mocked, node, callstack, metadata)
    }
    if (mocked != null && typeof mocked === 'object') {
      return mocked
    }
    return this._cachedRequest(url, mod, callstack, metadata)
  }

  // async directImport(url: string, callstack: string[] = []): Promise<any> {
  //   const module = await (this as any).cachedModule(url) /** TODO: private method */
  //   return this.directRequest(url, module, callstack)
  // }
}

export interface VitestModuleRunnerOptions {
  transport: VitestTransportOptions
  evaluatedModules: EvaluatedModules
  getWorkerState: () => WorkerGlobalState
  vm?: VitestVmOptions
}

export interface VitestVmOptions {
  context: vm.Context
  externalModulesExecutor: ExternalModulesExecutor
}

interface VitestTransportOptions {
  fetchModule: FetchFunction
  resolveId: (id: string, importer?: string) => Promise<{
    id: string
    file: string
    url: string
  } | null>
}

class VitestTransport {
  constructor(private options: VitestTransportOptions) {}

  async invoke(event: HotPayload) {
    if (event.type !== 'custom') {
      throw new Error(`Vitest Module Runner doesn't support Vite HMR events.`)
    }
    if (event.event !== 'vite:invoke') {
      throw new Error(`Vitest Module Runner doesn't support ${event.event} event.`)
    }
    const { name, data } = event.data
    if (name !== 'fetchModule') {
      throw new Error(`Unknown method: ${name}. Expected "fetchModule".`)
    }
    const result = await this.options.fetchModule(...data as Parameters<FetchFunction>)
    return { result }
  }
}

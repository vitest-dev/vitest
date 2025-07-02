import type { MockedModule } from '@vitest/mocker'
import type vm from 'node:vm'
import type { HotPayload } from 'vite'
import type { EvaluatedModuleNode, EvaluatedModules, FetchFunction, SSRImportMetadata } from 'vite/module-runner'
import type { WorkerGlobalState } from '../../types/worker'
import type { ExternalModulesExecutor } from '../external-executor'
import type { VitestModuleEvaluator } from './moduleEvaluator'
import { ModuleRunner } from 'vite/module-runner'
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
        evaluatedModules: options.evaluatedModules,
      },
      options.evaluator,
    )
    this.mocker = options.mocker || new VitestMocker(this, {
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
    if (ignoreMock) {
      return this._cachedRequest(url, mod, callstack, metadata)
    }

    let mocked: any
    if (mod.meta && 'mockedModule' in mod.meta) {
      mocked = await this.mocker.requestWithMockedModule(
        url,
        mod,
        callstack,
        mod.meta.mockedModule as MockedModule,
      )
    }
    else {
      mocked = await this.mocker.mockedRequest(url, mod, callstack)
    }

    if (typeof mocked === 'string') {
      const node = await this.fetchModule(mocked)
      return this._cachedRequest(mocked, node, callstack, metadata)
    }
    if (mocked != null && typeof mocked === 'object') {
      return mocked
    }
    return this._cachedRequest(url, mod, callstack, metadata)
  }

  /** @internal */
  public _invalidateSubTreeById(ids: string[], invalidated = new Set<string>()): void {
    for (const id of ids) {
      if (invalidated.has(id)) {
        continue
      }
      const node = this.evaluatedModules.getModuleById(id)
      if (!node) {
        continue
      }
      invalidated.add(id)
      const subIds = Array.from(this.evaluatedModules.idToModuleMap)
        .filter(([, mod]) => mod.importers.has(id))
        .map(([key]) => key)
      if (subIds.length) {
        this._invalidateSubTreeById(subIds, invalidated)
      }
      this.evaluatedModules.invalidateModule(node)
    }
  }
}

export interface VitestModuleRunnerOptions {
  transport: VitestTransportOptions
  evaluator: VitestModuleEvaluator
  evaluatedModules: EvaluatedModules
  mocker?: VitestMocker
  getWorkerState: () => WorkerGlobalState
  vm?: VitestVmOptions
}

export interface VitestVmOptions {
  context: vm.Context
  externalModulesExecutor: ExternalModulesExecutor
}

export interface VitestTransportOptions {
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

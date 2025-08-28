import type { MockedModule } from '@vitest/mocker'
import type vm from 'node:vm'
import type { EvaluatedModuleNode, EvaluatedModules, SSRImportMetadata } from 'vite/module-runner'
import type { WorkerGlobalState } from '../../types/worker'
import type { ExternalModulesExecutor } from '../external-executor'
import type { ModuleExecutionInfo } from './moduleDebug'
import type { VitestModuleEvaluator } from './moduleEvaluator'
import type { VitestTransportOptions } from './moduleTransport'
import * as viteModuleRunner from 'vite/module-runner'
import { VitestMocker } from './moduleMocker'
import { VitestTransport } from './moduleTransport'

// eslint-disable-next-line ts/ban-ts-comment
// @ts-ignore available since Vite 7.1 https://github.com/vitejs/vite/pull/20260
export type CreateImportMeta = typeof viteModuleRunner.createNodeImportMeta

// @ts-expect-error overriding private method
export class VitestModuleRunner extends viteModuleRunner.ModuleRunner {
  public mocker: VitestMocker
  public moduleExecutionInfo: ModuleExecutionInfo

  constructor(private vitestOptions: VitestModuleRunnerOptions) {
    const options = vitestOptions
    const transport = new VitestTransport(options.transport)
    const evaluatedModules = options.evaluatedModules
    super(
      {
        transport,
        hmr: false,
        evaluatedModules,
        sourcemapInterceptor: 'prepareStackTrace',
        createImportMeta: vitestOptions.createImportMeta,
      },
      options.evaluator,
    )
    this.moduleExecutionInfo = options.getWorkerState().moduleExecutionInfo
    this.mocker = options.mocker || new VitestMocker(this, {
      spyModule: options.spyModule,
      context: options.vm?.context,
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

  public async import(rawId: string): Promise<any> {
    const resolved = await this.vitestOptions.transport.resolveId(rawId)
    if (!resolved) {
      return super.import(rawId)
    }
    return super.import(resolved.url)
  }

  public async fetchModule(url: string, importer?: string): Promise<EvaluatedModuleNode> {
    const module = await (this as any).cachedModule(url, importer)
    return module
  }

  private _cachedRequest(
    url: string,
    module: EvaluatedModuleNode,
    callstack: string[] = [],
    metadata?: SSRImportMetadata,
  ) {
    // @ts-expect-error "cachedRequest" is private
    return super.cachedRequest(url, module, callstack, metadata)
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
  getWorkerState: () => WorkerGlobalState
  mocker?: VitestMocker
  vm?: VitestVmOptions
  spyModule?: typeof import('@vitest/spy')
  createImportMeta?: CreateImportMeta
}

export interface VitestVmOptions {
  context: vm.Context
  externalModulesExecutor: ExternalModulesExecutor
}

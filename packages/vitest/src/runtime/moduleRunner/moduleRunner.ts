import type { MockedModule } from '@vitest/mocker'
import type vm from 'node:vm'
import type { EvaluatedModuleNode, EvaluatedModules, SSRImportMetadata } from 'vite/module-runner'
import type { WorkerGlobalState } from '../../types/worker'
import type { ExternalModulesExecutor } from '../external-executor'
import type { ModuleExecutionInfo } from './moduleDebug'
import type { VitestModuleEvaluator } from './moduleEvaluator'
import type { VitestTransportOptions } from './moduleTransport'
import type { TestModuleRunner } from './testModuleRunner'
import * as viteModuleRunner from 'vite/module-runner'
import { Traces } from '../../utils/traces'
import { VitestMocker } from './moduleMocker'
import { VitestTransport } from './moduleTransport'

export type CreateImportMeta = (modulePath: string) => viteModuleRunner.ModuleRunnerImportMeta | Promise<viteModuleRunner.ModuleRunnerImportMeta>
export const createNodeImportMeta: CreateImportMeta = (modulePath: string) => {
  if (!viteModuleRunner.createDefaultImportMeta) {
    throw new Error(`createNodeImportMeta is not supported in this version of Vite.`)
  }

  const defaultMeta = viteModuleRunner.createDefaultImportMeta(modulePath)
  const href = defaultMeta.url

  const importMetaResolver = createImportMetaResolver()

  return {
    ...defaultMeta,
    main: false,
    resolve(id: string, parent?: string) {
      const resolver = importMetaResolver ?? defaultMeta.resolve
      return resolver(id, parent ?? href)
    },
  }
}

function createImportMetaResolver() {
  if (!import.meta.resolve) {
    return
  }

  return (specifier: string, importer: string) =>
    import.meta.resolve(specifier, importer)
}

// @ts-expect-error overriding private method
export class VitestModuleRunner
  extends viteModuleRunner.ModuleRunner
  implements TestModuleRunner {
  public mocker: VitestMocker
  public moduleExecutionInfo: ModuleExecutionInfo
  private _otel: Traces
  private _callstacks: WeakMap<EvaluatedModuleNode, string[]>

  constructor(private vitestOptions: VitestModuleRunnerOptions) {
    const options = vitestOptions
    const evaluatedModules = options.evaluatedModules
    const callstacks = new WeakMap<EvaluatedModuleNode, string[]>()
    const transport = new VitestTransport(options.transport, evaluatedModules, callstacks)
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
    this._callstacks = callstacks
    this._otel = vitestOptions.traces || new Traces({ enabled: false })
    this.moduleExecutionInfo = options.getWorkerState().moduleExecutionInfo
    this.mocker = options.mocker || new VitestMocker(this, {
      spyModule: options.spyModule,
      context: options.vm?.context,
      traces: this._otel,
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

  /**
   * Vite checks that the module has exports emulating the Node.js behaviour,
   * but Vitest is more relaxed.
   *
   * We should keep the Vite behavour when there is a `strict` flag.
   * @internal
   */
  processImport(exports: Record<string, any>): Record<string, any> {
    return exports
  }

  public async import(rawId: string): Promise<any> {
    const resolved = await this._otel.$(
      'vitest.module.resolve_id',
      {
        attributes: {
          'vitest.module.raw_id': rawId,
        },
      },
      async (span) => {
        const result = await this.vitestOptions.transport.resolveId(rawId)
        if (result) {
          span.setAttributes({
            'vitest.module.url': result.url,
            'vitest.module.file': result.file,
            'vitest.module.id': result.id,
          })
        }
        return result
      },
    )
    return super.import(resolved ? resolved.url : rawId)
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
    // Track for a better error message if dynamic import is not resolved properly
    this._callstacks.set(mod, callstack)

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
  /**
   * @internal
   */
  traces?: Traces
  spyModule?: typeof import('@vitest/spy')
  createImportMeta?: CreateImportMeta
}

export interface VitestVmOptions {
  context: vm.Context
  externalModulesExecutor: ExternalModulesExecutor
}

import type vm from 'node:vm'
import type { HotPayload } from 'vite'
import type { FetchFunction } from 'vite/module-runner'
import type { WorkerGlobalState } from '../../types/worker'
import type { ExternalModulesExecutor } from '../external-executor'
import { ModuleRunner } from 'vite/module-runner'
import { VitestModuleEvaluator } from './moduleEvaluator'
import { VitestMocker } from './moduleMocker'

export class VitestModuleRunner extends ModuleRunner {
  public mocker: VitestMocker

  constructor(options: VitestModuleRunnerOptions) {
    super(
      {
        transport: new VitestTransport(options.transport),
        hmr: false,
      },
      new VitestModuleEvaluator(options.vm, {
        get interopDefault() {
          return options.getWorkerState().config.deps.interopDefault
        },
        getCurrentTestFilepath() {
          return options.getWorkerState().filepath
        },
      }),
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
  }

  /** @deprecated use `import` instead */
  executeId(id: string): Promise<any> {
    return this.import(id)
  }

  async directImport(url: string, callstack: string[] = []): Promise<any> {
    const module = await (this as any).cachedModule(url) /** TODO: private method */
    return this.directRequest(url, module, callstack)
  }
}

export interface VitestModuleRunnerOptions {
  transport: VitestTransportOptions
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

import type { WorkerGlobalState } from '../types/worker'
import type { ExecuteOptions } from './execute'
import { resolve } from 'node:path'
import { VitestMocker } from './mocker'

export class NativeExecutor {
  public mocker: VitestMocker

  public options: ExecuteOptions

  constructor(state: WorkerGlobalState) {
    this.options = {
      state,
      root: state.config.root,
      async fetchModule() {
        throw new Error(`fetchModule is not implemented in native executor`)
      },
    }
    this.mocker = new VitestMocker(this as any)
    Object.defineProperty(globalThis, '__vitest_mocker__', {
      value: this.mocker,
      configurable: true,
    })
  }

  executeId(id: string) {
    return import(resolve(this.state.config.root, id))
  }

  executeFile(id: string) {
    return import(resolve(this.state.config.root, id))
  }

  get state(): WorkerGlobalState {
    // @ts-expect-error injected untyped global
    return globalThis.__vitest_worker__ || this.options.state
  }
}

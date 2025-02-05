import type { WorkerGlobalState } from '../types/worker'
import type { ExecuteOptions } from './execute'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ModuleCacheMap } from 'vite-node/client'
import { NativeMocker } from './native-mocker'

export class NativeExecutor {
  public mocker: NativeMocker
  public moduleCache = new ModuleCacheMap()

  public options: ExecuteOptions

  constructor(state: WorkerGlobalState) {
    this.options = {
      state,
      root: state.config.root,
      async fetchModule() {
        throw new Error(`fetchModule is not implemented in native executor`)
      },
    }
    this.mocker = new NativeMocker(state)
    // TODO: don't support mocker for now
    // Object.defineProperty(globalThis, '__vitest_mocker__', {
    //   value: this.mocker,
    //   configurable: true,
    // })
  }

  executeId(id: string) {
    return import(resolve(this.state.config.root, id))
  }

  executeFile(id: string) {
    return import(resolve(this.state.config.root, id))
  }

  cachedRequest(id: string) {
    return import(id)
  }

  // used by vi.importActual
  async originalResolveUrl(id: string, importer?: string) {
    try {
      const path = import.meta.resolve(id, importer ? pathToFileURL(importer) : undefined)
      return [path, path]
    }
    catch (error: any) {
      if (error.code === 'ERR_MODULE_NOT_FOUND') {
        Object.defineProperty(error, Symbol.for('vitest.error.not_found.data'), {
          value: { id },
        })
      }
      throw error
    }
  }

  get state(): WorkerGlobalState {
    // @ts-expect-error injected untyped global
    return globalThis.__vitest_worker__ || this.options.state
  }
}

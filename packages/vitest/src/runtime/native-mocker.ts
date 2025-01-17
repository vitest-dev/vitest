import type { WorkerGlobalState } from '../types/worker'
import module from 'node:module'

export class NativeMocker {
  constructor(private _state: WorkerGlobalState) {
    if (typeof (module as any).registerHooks === 'function') {
      (module as any).registerHooks({
        resolve: (specifier: string, context: ModuleResolveContext, nextResolve: any): ResolveReturn => {
          return this.onResolve(specifier, context, nextResolve)
        },
        load: (url: string, context: ModuleLoadContext, nextLoad: any): LoadResult => {
          return nextLoad(url, context)
        },
      })
    }
    else {
      console.error('module.register is not supported')
    }
  }

  reset() {
    // noop
  }

  onResolve(specifier: string, context: ModuleResolveContext, nextResolve: any): ResolveReturn {
    const result = nextResolve(specifier, context)
    // TODO: better filter
    if (context?.parentURL && !result.url.includes('node_modules')) {
      // this makes watch mode possible
      this.state.rpc.ensureModuleGraphEntry(result.url, context.parentURL)
    }
    return result
  }

  get state(): WorkerGlobalState {
    // @ts-expect-error injected untyped global
    return globalThis.__vitest_worker__ || this._state
  }
}

interface ModuleResolveContext {
  conditions: string[]
  importAttributes: Record<string, string>
  parentURL: string | undefined
}

interface ResolveReturn {
  format?: ModuleFormat | null
  importAttributes?: Record<string, string>
  shortCircuit?: boolean
  url: string
}

interface ModuleLoadContext {
  conditions: string[]
  importAttributes: Record<string, string>
  format: ModuleFormat | null | undefined
}

interface LoadResult {
  format: ModuleFormat
  shortCircuit?: boolean
  source: string | ArrayBuffer
}

type ModuleFormat = 'builtin' | 'commonjs' | 'json' | 'module' | 'wasm'

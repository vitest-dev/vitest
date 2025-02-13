import type { ResolveHook } from 'node:module'
import type { WorkerGlobalState } from '../types/worker'
import module from 'node:module'
import { MessageChannel } from 'node:worker_threads'

export class NativeMocker {
  constructor(private _state: WorkerGlobalState) {
    if (typeof (module as any).registerHooks === 'function') {
      (module as any).registerHooks({
        resolve: ((specifier, context, nextResolve) => {
          return this.onResolve(specifier, context, nextResolve)
        }) satisfies ResolveHook,
      })
    }
    else if (module.register) {
      const { port1, port2 } = new MessageChannel()
      port1.unref()
      port2.unref()
      port1.on('message', (data) => {
        if (typeof data !== 'object') {
          return
        }
        switch (data.event) {
          case 'register-module-graph-entry': {
            const { url, parentURL } = data
            this.state.rpc.ensureModuleGraphEntry(url, parentURL)
            return
          }
          default: {
            console.error('Unknown message event:', data.event)
          }
        }
      })
      module.register('#test-loader', {
        parentURL: import.meta.url,
        data: { port: port2 },
        transferList: [port2],
      })
    }
    // log the warning only for Node.js,
    // Deno doesn't support either of these APIs
    else if (typeof process.versions.node === 'string' && !process.versions.deno) {
      console.error(
        '"module.registerHooks" and "module.register" are not supported. Some features may not work. Please, use Node.js 18.19.0 or higher.',
      )
    }
  }

  reset() {
    // noop
  }

  onResolve: ResolveHook = (specifier, context, nextResolve) => {
    const result = nextResolve(specifier, context)
    // TODO: better filter
    if (context?.parentURL && 'url' in result && !result.url.includes('node_modules')) {
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

import type { Procedure } from './types'
import {
  MessageChannel,
  type MessagePort as NodeMessagePort,
} from 'node:worker_threads'
import { InlineWorkerRunner } from './runner'
import { debug, getFileIdFromUrl, getRunnerOptions } from './utils'

function convertNodePortToWebPort(port: NodeMessagePort): MessagePort {
  if (!('addEventListener' in port)) {
    Object.defineProperty(port, 'addEventListener', {
      value(...args: any[]) {
        return this.addListener(...args)
      },
      configurable: true,
      enumerable: true,
    })
  }
  if (!('removeEventListener' in port)) {
    Object.defineProperty(port, 'removeEventListener', {
      value(...args: any[]) {
        return this.removeListener(...args)
      },
      configurable: true,
      enumerable: true,
    })
  }
  if (!('dispatchEvent' in port)) {
    const emit = (port as any).emit.bind(port)
    Object.defineProperty(port, 'emit', {
      value(event: any) {
        if (event.name === 'message') {
          (port as any).onmessage?.(event)
        }
        if (event.name === 'messageerror') {
          (port as any).onmessageerror?.(event)
        }
        return emit(event)
      },
      configurable: true,
      enumerable: true,
    })
    Object.defineProperty(port, 'dispatchEvent', {
      value(event: any) {
        return this.emit(event)
      },
      configurable: true,
      enumerable: true,
    })
  }
  return port as any as MessagePort
}

export function createSharedWorkerConstructor(): typeof SharedWorker {
  const runnerOptions = getRunnerOptions()

  return class SharedWorker extends EventTarget {
    static __VITEST_WEB_WORKER__ = true

    private _vw_workerTarget = new EventTarget()
    private _vw_name: string
    private _vw_workerPort: MessagePort

    public onerror: null | Procedure = null

    public port: MessagePort

    constructor(url: URL | string, options?: WorkerOptions | string) {
      super()

      const name = typeof options === 'string' ? options : options?.name
      let selfProxy: typeof globalThis

      const context = {
        onmessage: null,
        onmessageerror: null,
        onerror: null,
        onlanguagechange: null,
        onoffline: null,
        ononline: null,
        onrejectionhandled: null,
        onrtctransform: null,
        onunhandledrejection: null,
        origin: typeof location !== 'undefined' ? location.origin : 'http://localhost:3000',
        importScripts: () => {
          throw new Error(
            '[vitest] `importScripts` is not supported in Vite workers. Please, consider using `import` instead.',
          )
        },
        crossOriginIsolated: false,
        onconnect: null as ((e: MessageEvent) => void) | null,
        name: name || '',
        close: () => this.port.close(),
        dispatchEvent: (event: Event) => {
          return this._vw_workerTarget.dispatchEvent(event)
        },
        addEventListener: (...args: any[]) => {
          return this._vw_workerTarget.addEventListener(...args as [any, any])
        },
        removeEventListener: this._vw_workerTarget.removeEventListener,
        get self() {
          return selfProxy
        },
      }

      selfProxy = new Proxy(context, {
        get(target, prop, receiver) {
          if (Reflect.has(target, prop)) {
            return Reflect.get(target, prop, receiver)
          }
          return Reflect.get(globalThis, prop, receiver)
        },
      }) as any

      const channel = new MessageChannel()
      this.port = convertNodePortToWebPort(channel.port1)
      this._vw_workerPort = convertNodePortToWebPort(channel.port2)

      this._vw_workerTarget.addEventListener('connect', (e) => {
        context.onconnect?.(e as MessageEvent)
      })

      const runner = new InlineWorkerRunner(runnerOptions, context)

      const id = getFileIdFromUrl(url)

      this._vw_name = id

      runner
        .resolveUrl(id)
        .then(([, fsPath]) => {
          this._vw_name = name ?? fsPath

          debug('initialize shared worker %s', this._vw_name)

          return runner.executeFile(fsPath).then(() => {
            // worker should be new every time, invalidate its sub dependency
            runnerOptions.moduleCache.invalidateSubDepTree([
              fsPath,
              runner.mocker.getMockPath(fsPath),
            ])
            this._vw_workerTarget.dispatchEvent(
              new MessageEvent('connect', {
                ports: [this._vw_workerPort],
              }),
            )
            debug('shared worker %s successfully initialized', this._vw_name)
          })
        })
        .catch((e) => {
          debug('shared worker %s failed to initialize: %o', this._vw_name, e)
          const EventConstructor = globalThis.ErrorEvent || globalThis.Event
          const error = new EventConstructor('error', {
            error: e,
            message: e.message,
          })
          this.dispatchEvent(error)
          this.onerror?.(error)
          console.error(e)
        })
    }
  }
}

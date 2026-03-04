import type { MessagePort as NodeMessagePort } from 'node:worker_threads'
import type { Procedure } from './types'
import { MessageChannel } from 'node:worker_threads'
import { startWebWorkerModuleRunner } from './runner'
import { debug, getFileIdFromUrl } from './utils'

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
        removeEventListener: (...args: any[]) => {
          return this._vw_workerTarget.removeEventListener(...args as [any, any])
        },
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

      const fileId = getFileIdFromUrl(url)

      this._vw_name = fileId

      const runner = startWebWorkerModuleRunner(context)
      runner.mocker.resolveId(fileId).then(({ url, id: resolvedId }) => {
        this._vw_name = name ?? url
        debug('initialize shared worker %s', this._vw_name)

        return runner.import(url).then(() => {
          runner._invalidateSubTreeById([
            resolvedId,
            runner.mocker.getMockPath(resolvedId),
          ])
          this._vw_workerTarget.dispatchEvent(
            new MessageEvent('connect', {
              ports: [this._vw_workerPort],
            }),
          )
          debug('shared worker %s successfully initialized', this._vw_name)
        })
      }).catch((e) => {
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

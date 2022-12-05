/* eslint-disable no-restricted-imports */
import { VitestRunner } from 'vitest/node'
import type { WorkerGlobalState } from 'vitest'
import ponyfillStructuredClone from '@ungap/structured-clone'

function getWorkerState(): WorkerGlobalState {
  // @ts-expect-error untyped global
  return globalThis.__vitest_worker__
}

type Procedure = (...args: any[]) => void

type CloneOption = 'native' | 'ponyfill' | 'none'

interface DefineWorkerOptions {
  clone: CloneOption
}

interface InlineWorkerContext {
  onmessage: Procedure | null
  name?: string
  close: () => void
  dispatchEvent: (e: Event) => void
  addEventListener: (e: string, fn: Procedure) => void
  removeEventListener: (e: string, fn: Procedure) => void
  postMessage: (data: any, transfer?: Transferable[] | StructuredSerializeOptions) => void
  self: InlineWorkerContext
  global: InlineWorkerContext
  importScripts?: any
}

class InlineWorkerRunner extends VitestRunner {
  constructor(options: any, private context: InlineWorkerContext) {
    super(options)
  }

  prepareContext(context: Record<string, any>) {
    const ctx = super.prepareContext(context)
    // not supported for now, we can't synchronously load modules
    const importScripts = () => {
      throw new Error('[vitest] `importScripts` is not supported in Vite workers. Please, consider using `import` instead.')
    }
    return Object.assign(ctx, this.context, {
      importScripts,
    })
  }
}

function assertGlobalExists(name: string) {
  if (!(name in globalThis))
    throw new Error(`[@vitest/web-worker] Cannot initiate a custom Web Worker. "${name}" is not supported in this environment. Please, consider using jsdom or happy-dom environment.`)
}

function createClonedMessageEvent(data: any, transferOrOptions: StructuredSerializeOptions | Transferable[] | undefined, clone: CloneOption) {
  const transfer = Array.isArray(transferOrOptions) ? transferOrOptions : transferOrOptions?.transfer

  if (typeof structuredClone === 'function' && clone === 'native') {
    return new MessageEvent('message', {
      data: structuredClone(data, { transfer }),
      origin: window.location.origin,
    })
  }
  if (clone !== 'none') {
    transfer?.length && console.warn(
      '[@vitest/web-worker] `structuredClone` is not supported in this environment. '
      + 'Falling back to polyfill, your transferable options will be lost. '
      + 'Set `VITEST_WEB_WORKER_CLONE` environmental variable to "none", if you don\'t want to loose it,'
      + 'or update to Node 17+.',
    )
    return new MessageEvent('message', {
      data: ponyfillStructuredClone(data, { lossy: true }),
      origin: window.location.origin,
    })
  }
  return new MessageEvent('message', {
    data,
    origin: window.location.origin,
  })
}

function createMessageEvent(data: any, transferOrOptions: StructuredSerializeOptions | Transferable[] | undefined, clone: CloneOption) {
  try {
    return createClonedMessageEvent(data, transferOrOptions, clone)
  }
  catch (error) {
    return new ErrorEvent('messageerror', {
      error,
      message: error instanceof Error ? error.message : undefined,
    })
  }
}

export function defineWebWorker(options?: DefineWorkerOptions) {
  if (typeof Worker !== 'undefined' && '__VITEST_WEB_WORKER__' in globalThis.Worker)
    return

  assertGlobalExists('window')
  assertGlobalExists('EventTarget')
  assertGlobalExists('MessageEvent')
  assertGlobalExists('ErrorEvent')

  const { config, rpc, mockMap, moduleCache } = getWorkerState()

  const runnerOptions = {
    fetchModule(id: string) {
      return rpc.fetch(id)
    },
    resolveId(id: string, importer?: string) {
      return rpc.resolveId(id, importer)
    },
    moduleCache,
    mockMap,
    interopDefault: config.deps.interopDefault ?? true,
    root: config.root,
    base: config.base,
  }

  const cloneType = (options?.clone ?? process.env.VITEST_WEB_WORKER_CLONE ?? 'native') as CloneOption

  globalThis.Worker = class Worker extends EventTarget {
    static __VITEST_WEB_WORKER__ = true

    private inside = new EventTarget()
    private insideListeners = new Map<string, EventListenerOrEventListenerObject>()
    private outsideListeners = new Map<string, EventListenerOrEventListenerObject>()

    private messageQueue: any[] | null = []

    public onmessage: null | Procedure = null
    public onmessageerror: null | Procedure = null
    public onerror: null | Procedure = null

    constructor(url: URL | string, options?: WorkerOptions) {
      super()

      // should equal to DedicatedWorkerGlobalScope
      const context: InlineWorkerContext = {
        onmessage: null,
        name: options?.name,
        close: () => this.terminate(),
        dispatchEvent: (event: Event) => {
          return this.inside.dispatchEvent(event)
        },
        addEventListener: (...args) => {
          if (args[1])
            this.insideListeners.set(args[0], args[1])
          return this.inside.addEventListener(...args)
        },
        removeEventListener: this.inside.removeEventListener,
        postMessage: (...args) => {
          if (!args.length)
            throw new SyntaxError('"postMessage" requires at least one argument.')

          const event = createMessageEvent(args[0], args[1], cloneType)
          this.dispatchEvent(event)
        },
        get self() {
          return context
        },
        get global() {
          return context
        },
      }

      this.inside.addEventListener('message', (e) => {
        context.onmessage?.(e)
      })

      this.addEventListener('message', (e) => {
        this.onmessage?.(e)
      })

      this.addEventListener('messageerror', (e) => {
        this.onmessageerror?.(e)
      })

      const runner = new InlineWorkerRunner(runnerOptions, context)

      const id = (url instanceof URL ? url.toString() : url).replace(/^file:\/+/, '/')

      runner.resolveUrl(id).then(([, fsPath]) => {
        runner.executeFile(fsPath).then(() => {
          // worker should be new every time, invalidate its sub dependency
          moduleCache.invalidateSubDepTree([fsPath, runner.mocker.getMockPath(fsPath)])
          const q = this.messageQueue
          this.messageQueue = null
          if (q)
            q.forEach(([data, transfer]) => this.postMessage(data, transfer), this)
        }).catch((e) => {
          const error = new ErrorEvent('error', {
            error: e,
            message: e.message,
          })
          this.dispatchEvent(error)
          this.onerror?.(e)
          console.error(e)
        })
      })
    }

    addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void {
      if (callback)
        this.outsideListeners.set(type, callback)
      return super.addEventListener(type, callback, options)
    }

    postMessage(...args: [any, StructuredSerializeOptions | Transferable[] | undefined]): void {
      if (!args.length)
        throw new SyntaxError('"postMessage" requires at least one argument.')

      const [data, transferOrOptions] = args
      if (this.messageQueue != null) {
        this.messageQueue.push([data, transferOrOptions])
        return
      }

      const event = createMessageEvent(data, transferOrOptions, cloneType)
      this.inside.dispatchEvent(event)
    }

    terminate() {
      this.outsideListeners.forEach((fn, type) => {
        this.removeEventListener(type, fn)
      })
      this.insideListeners.forEach((fn, type) => {
        this.inside.removeEventListener(type, fn)
      })
    }
  }
}

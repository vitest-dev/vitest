import type { ExecuteOptions } from '../node/execute'
import { VitestRunner } from '../node/execute'
import { rpc } from './rpc'
import { mockMap, moduleCache } from './worker'

type Procedure = (...args: any[]) => void

class Bridge {
  private callbacks: Record<string, (Procedure)[]> = {}
  public on(event: string, fn: Procedure) {
    this.callbacks[event] ??= []
    this.callbacks[event].push(fn)
  }

  public off(event: string, fn: Procedure) {
    if (this.callbacks[event])
      this.callbacks[event] = this.callbacks[event].filter(f => f !== fn)
  }

  public removeEvents(event: string) {
    this.callbacks[event] = []
  }

  public emit(event: string, ...data: any[]) {
    return (this.callbacks[event] || []).map(fn => fn(...data))
  }
}

interface InlineWorkerContext {
  onmessage: Procedure | null
  dispatchEvent: (e: Event) => void
  addEventListener: (e: string, fn: Procedure) => void
  removeEventListener: (e: string, fn: Procedure) => void
  postMessage: (data: any) => void
  self?: InlineWorkerContext
  // fetch: global.fetch,
  // importScripts() {}
}

class InlineWorkerRunner extends VitestRunner {
  constructor(options: ExecuteOptions, private context: InlineWorkerContext) {
    super(options)
  }

  prepareContext(context: Record<string, any>) {
    const ctx = super.prepareContext(context)
    return Object.assign(ctx, this.context, {
      importScripts: ctx.__vite_ssr_dynamic_import__,
    })
  }
}

export function defineInlineWorker() {
  const { config } = process.__vitest_worker__
  const runnerOptions: ExecuteOptions = {
    fetchModule(id) {
      return rpc().fetch(id)
    },
    resolveId(id, importer) {
      return rpc().resolveId(id, importer)
    },
    moduleCache,
    mockMap,
    interopDefault: config.deps.interopDefault ?? true,
    root: config.root,
    base: config.base,
  }

  globalThis.Worker = class Worker {
    private inside = new Bridge()
    private outside = new Bridge()

    private messageQueue: any[] | null = []

    public onmessage: null | Procedure = null
    public onmessageerror: null | Procedure = null
    public onerror: null | Procedure = null

    constructor(url: URL | string) {
      const context: InlineWorkerContext = {
        onmessage: null,
        dispatchEvent: (event: Event) => {
          this.inside.emit(event.type, event)
          return true
        },
        addEventListener: this.inside.on,
        removeEventListener: this.inside.off,
        postMessage: (data) => {
          this.outside.emit('message', { data })
        },
        // fetch: global.fetch,
        // importScripts() {}
      }

      context.self = context

      this.inside.on('message', (e) => {
        context.onmessage?.(e)
      })

      this.outside.on('message', (e) => {
        this.onmessage?.(e)
      })

      const runner = new InlineWorkerRunner(runnerOptions, context)

      const id = url instanceof URL ? url.toString() : url

      runner.executeId(id)
        .then(() => {
          const q = this.messageQueue
          this.messageQueue = null
          if (q)
            q.forEach(this.postMessage)
        }).catch((e) => {
          this.outside.emit('error', e)
          this.onerror?.(e)
          console.error(e)
        })
    }

    dispatchEvent(event: Event) {
      this.outside.emit(event.type, event)
      return true
    }

    addEventListener(event: string, fn: Procedure) {
      this.outside.on(event, fn)
    }

    removeEventListener(event: string, fn: Procedure) {
      this.outside.off(event, fn)
    }

    postMessage(data: any) {
      if (this.messageQueue != null)
        this.messageQueue.push(data)
      else
        this.inside.emit('message', { data })
    }

    terminate() {
      throw new Error('not supported')
    }
  }
}

import type {
  CloneOption,
  DefineWorkerOptions,
  InlineWorkerContext,
  Procedure,
} from './types'
import { InlineWorkerRunner } from './runner'
import {
  createMessageEvent,
  debug,
  getFileIdFromUrl,
  getRunnerOptions,
} from './utils'

export function createWorkerConstructor(
  options?: DefineWorkerOptions,
): typeof Worker {
  const runnerOptions = getRunnerOptions()
  const cloneType = () =>
    (options?.clone
    ?? process.env.VITEST_WEB_WORKER_CLONE
    ?? 'native') as CloneOption

  return class Worker extends EventTarget {
    static __VITEST_WEB_WORKER__ = true

    private _vw_workerTarget = new EventTarget()
    private _vw_insideListeners = new Map<
      string,
      EventListenerOrEventListenerObject
    >()

    private _vw_outsideListeners = new Map<
      string,
      EventListenerOrEventListenerObject
    >()

    private _vw_name: string
    private _vw_messageQueue: any[] | null = []

    public onmessage: null | Procedure = null
    public onmessageerror: null | Procedure = null
    public onerror: null | Procedure = null

    constructor(url: URL | string, options?: WorkerOptions) {
      super()

      // should be equal to DedicatedWorkerGlobalScope
      const context: InlineWorkerContext = {
        onmessage: null,
        name: options?.name,
        close: () => this.terminate(),
        dispatchEvent: (event: Event) => {
          return this._vw_workerTarget.dispatchEvent(event)
        },
        addEventListener: (...args) => {
          if (args[1]) {
            this._vw_insideListeners.set(args[0], args[1])
          }
          return this._vw_workerTarget.addEventListener(...args)
        },
        removeEventListener: this._vw_workerTarget.removeEventListener,
        postMessage: (...args) => {
          if (!args.length) {
            throw new SyntaxError(
              '"postMessage" requires at least one argument.',
            )
          }

          debug(
            'posting message %o from the worker %s to the main thread',
            args[0],
            this._vw_name,
          )
          const event = createMessageEvent(args[0], args[1], cloneType())
          this.dispatchEvent(event)
        },
        get self() {
          return context
        },
        get global() {
          return context
        },
      }

      this._vw_workerTarget.addEventListener('message', (e) => {
        context.onmessage?.(e)
      })

      this.addEventListener('message', (e) => {
        this.onmessage?.(e)
      })

      this.addEventListener('messageerror', (e) => {
        this.onmessageerror?.(e)
      })

      const runner = new InlineWorkerRunner(runnerOptions, context)

      const id = getFileIdFromUrl(url)

      this._vw_name = id

      runner
        .resolveUrl(id)
        .then(([, fsPath]) => {
          this._vw_name = options?.name ?? fsPath

          debug('initialize worker %s', this._vw_name)

          return runner.executeFile(fsPath).then(() => {
            // worker should be new every time, invalidate its sub dependency
            runnerOptions.moduleCache.invalidateSubDepTree([
              fsPath,
              runner.mocker.getMockPath(fsPath),
            ])
            const q = this._vw_messageQueue
            this._vw_messageQueue = null
            if (q) {
              q.forEach(
                ([data, transfer]) => this.postMessage(data, transfer),
                this,
              )
            }
            debug('worker %s successfully initialized', this._vw_name)
          })
        })
        .catch((e) => {
          debug('worker %s failed to initialize: %o', this._vw_name, e)
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

    addEventListener(
      type: string,
      callback: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void {
      if (callback) {
        this._vw_outsideListeners.set(type, callback)
      }
      return super.addEventListener(type, callback, options)
    }

    postMessage(
      ...args: [any, StructuredSerializeOptions | Transferable[] | undefined]
    ): void {
      if (!args.length) {
        throw new SyntaxError('"postMessage" requires at least one argument.')
      }

      const [data, transferOrOptions] = args
      if (this._vw_messageQueue != null) {
        debug(
          'worker %s is not yet initialized, queue message %s',
          this._vw_name,
          data,
        )
        this._vw_messageQueue.push([data, transferOrOptions])
        return
      }

      debug(
        'posting message %o from the main thread to the worker %s',
        data,
        this._vw_name,
      )

      const event = createMessageEvent(data, transferOrOptions, cloneType())
      if (event.type === 'messageerror') {
        this.dispatchEvent(event)
      }
      else {
        this._vw_workerTarget.dispatchEvent(event)
      }
    }

    terminate() {
      debug('terminating worker %s', this._vw_name)
      this._vw_outsideListeners.forEach((fn, type) => {
        this.removeEventListener(type, fn)
      })
      this._vw_insideListeners.forEach((fn, type) => {
        this._vw_workerTarget.removeEventListener(type, fn)
      })
    }
  }
}

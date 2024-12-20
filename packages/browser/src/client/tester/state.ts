import type { BrowserRPC } from '@vitest/browser/client'
import type { WorkerGlobalState } from 'vitest'
import { parse } from 'flatted'
import { getBrowserState } from '../utils'

const config = getBrowserState().config
const sessionId = getBrowserState().sessionId

const providedContext = parse(getBrowserState().providedContext)

const state: WorkerGlobalState = {
  ctx: {
    pool: 'browser',
    worker: './browser.js',
    workerId: 1,
    config,
    projectName: config.name || '',
    files: [],
    environment: {
      name: 'browser',
      options: null,
    },
    providedContext,
    invalidates: [],
  },
  onCancel: null as any,
  config,
  environment: {
    name: 'browser',
    transformMode: 'web',
    setup() {
      throw new Error('Not called in the browser')
    },
  },
  moduleCache: getBrowserState().moduleCache,
  rpc: null as any,
  durations: {
    environment: 0,
    prepare: performance.now(),
  },
  providedContext,
}

// @ts-expect-error not typed global
globalThis.__vitest_browser__ = true
// @ts-expect-error not typed global
globalThis.__vitest_worker__ = state

getBrowserState().cdp = createCdp()

function rpc() {
  return state.rpc as any as BrowserRPC
}

function createCdp() {
  const listenersMap = new WeakMap<Function, string>()

  function getId(listener: Function) {
    const id = listenersMap.get(listener) || crypto.randomUUID()
    listenersMap.set(listener, id)
    return id
  }

  const listeners: Record<string, Function[]> = {}

  const cdp = {
    send(method: string, params?: Record<string, any>) {
      return rpc().sendCdpEvent(sessionId, method, params)
    },
    on(event: string, listener: (payload: any) => void) {
      const listenerId = getId(listener)
      listeners[event] = listeners[event] || []
      listeners[event].push(listener)
      rpc().trackCdpEvent(sessionId, 'on', event, listenerId).catch(error)
      return cdp
    },
    once(event: string, listener: (payload: any) => void) {
      const listenerId = getId(listener)
      const handler = (data: any) => {
        listener(data)
        cdp.off(event, listener)
      }
      listeners[event] = listeners[event] || []
      listeners[event].push(handler)
      rpc().trackCdpEvent(sessionId, 'once', event, listenerId).catch(error)
      return cdp
    },
    off(event: string, listener: (payload: any) => void) {
      const listenerId = getId(listener)
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(l => l !== listener)
      }
      rpc().trackCdpEvent(sessionId, 'off', event, listenerId).catch(error)
      return cdp
    },
    emit(event: string, payload: unknown) {
      if (listeners[event]) {
        listeners[event].forEach((l) => {
          try {
            l(payload)
          }
          catch (err) {
            error(err)
          }
        })
      }
    },
  }

  return cdp
}

function error(err: unknown) {
  window.dispatchEvent(new ErrorEvent('error', { error: err }))
}

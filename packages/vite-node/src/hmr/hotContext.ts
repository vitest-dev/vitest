import type { InferCustomEventPayload } from 'vite'
import type { ViteNodeRunner } from '../client'
import type { HotContext } from '../types'
import { reload, sendMessageBuffer } from './hmr'
import type { HMREmitter } from './emitter'

export interface HotModule {
  id: string
  callbacks: HotCallback[]
}

export interface HotCallback {
  // the dependencies must be fetchable paths
  deps: string[]
  fn: (modules: object[]) => void
}

interface CacheData {
  hotModulesMap: Map<string, HotModule>
  dataMap: Map<string, any>
  disposeMap: Map<string, (data: any) => void | Promise<void>>
  pruneMap: Map<string, (data: any) => void | Promise<void>>
  customListenersMap: Map<string, ((data: any) => void)[]>
  ctxToListenersMap: Map<
    string,
    Map<string, ((data: any) => void)[]>
  >
  messageBuffer: string[]
  isFirstUpdate: boolean
  pending: boolean
  queued: Promise<(() => void) | undefined>[]
}

const cache: WeakMap<ViteNodeRunner, CacheData> = new WeakMap()

export function getCache(runner: ViteNodeRunner): CacheData {
  if (!cache.has(runner)) {
    cache.set(runner, {
      hotModulesMap: new Map(),
      dataMap: new Map(),
      disposeMap: new Map(),
      pruneMap: new Map(),
      customListenersMap: new Map(),
      ctxToListenersMap: new Map(),
      messageBuffer: [],
      isFirstUpdate: false,
      pending: false,
      queued: [],
    })
  }
  return cache.get(runner) as CacheData
}

export function createHotContext(
  runner: ViteNodeRunner,
  emitter: HMREmitter,
  files: string[],
  ownerPath: string,
): HotContext {
  const maps = getCache(runner)
  if (!maps.dataMap.has(ownerPath))
    maps.dataMap.set(ownerPath, {})

  // when a file is hot updated, a new context is created
  // clear its stale callbacks
  const mod = maps.hotModulesMap.get(ownerPath)
  if (mod)
    mod.callbacks = []

  const newListeners = new Map()
  maps.ctxToListenersMap.set(ownerPath, newListeners)

  function acceptDeps(deps: string[], callback: HotCallback['fn'] = () => {}) {
    const mod: HotModule = maps.hotModulesMap.get(ownerPath) || {
      id: ownerPath,
      callbacks: [],
    }
    mod.callbacks.push({
      deps,
      fn: callback,
    })
    maps.hotModulesMap.set(ownerPath, mod)
  }

  const hot: HotContext = {
    get data() {
      return maps.dataMap.get(ownerPath)
    },

    accept(deps?: any, callback?: any) {
      if (typeof deps === 'function' || !deps) {
        // self-accept: hot.accept(() => {})
        acceptDeps([ownerPath], ([mod]) => deps && deps(mod))
      }
      else if (typeof deps === 'string') {
        // explicit deps
        acceptDeps([deps], ([mod]) => callback && callback(mod))
      }
      else if (Array.isArray(deps)) {
        acceptDeps(deps, callback)
      }
      else {
        throw new TypeError('invalid hot.accept() usage.')
      }
    },

    dispose(cb) {
      maps.disposeMap.set(ownerPath, cb)
    },

    // @ts-expect-error untyped
    prune(cb: (data: any) => void) {
      maps.pruneMap.set(ownerPath, cb)
    },

    invalidate() {
      return reload(runner, files)
    },

    on<T extends string>(
      event: T,
      cb: (payload: InferCustomEventPayload<T>) => void,
    ): void {
      const addToMap = (map: Map<string, any[]>) => {
        const existing = map.get(event) || []
        existing.push(cb)
        map.set(event, existing)
      }
      addToMap(maps.customListenersMap)
      addToMap(newListeners)
    },

    send<T extends string>(event: T, data?: InferCustomEventPayload<T>): void {
      maps.messageBuffer.push(JSON.stringify({ type: 'custom', event, data }))
      sendMessageBuffer(runner, emitter)
    },
  }

  return hot
}

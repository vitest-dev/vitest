/* eslint-disable no-console */

import type { HMRPayload, Update } from 'vite/types/hmrPayload.js'
import type { CustomEventMap } from 'vite/types/customEvent.js'
import c from 'picocolors'
import createDebug from 'debug'
import type { ViteNodeRunner } from '../client'
import type { HotContext } from '../types'
import { normalizeRequestId } from '../utils'
import type { HMREmitter } from './emitter'

export type ModuleNamespace = Record<string, any> & {
  [Symbol.toStringTag]: 'Module'
}

const debugHmr = createDebug('vite-node:hmr')

export type InferCustomEventPayload<T extends string> =
  T extends keyof CustomEventMap ? CustomEventMap[T] : any

export interface HotModule {
  id: string
  callbacks: HotCallback[]
}

export interface HotCallback {
  // the dependencies must be fetchable paths
  deps: string[]
  fn: (modules: (ModuleNamespace | undefined)[]) => void
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

export function sendMessageBuffer(runner: ViteNodeRunner, emitter: HMREmitter) {
  const maps = getCache(runner)
  maps.messageBuffer.forEach(msg => emitter.emit('custom', msg))
  maps.messageBuffer.length = 0
}

export async function reload(runner: ViteNodeRunner, files: string[]) {
  // invalidate module cache but not node_modules
  Array.from(runner.moduleCache.keys())
    .forEach((fsPath) => {
      if (!fsPath.includes('node_modules'))
        runner.moduleCache.delete(fsPath)
    })

  return Promise.all(files.map(file => runner.executeId(file)))
}

async function notifyListeners<T extends string>(
  runner: ViteNodeRunner,
  event: T,
  data: InferCustomEventPayload<T>,
): Promise<void>
async function notifyListeners(runner: ViteNodeRunner, event: string, data: any): Promise<void> {
  const maps = getCache(runner)
  const cbs = maps.customListenersMap.get(event)
  if (cbs)
    await Promise.all(cbs.map(cb => cb(data)))
}

async function queueUpdate(runner: ViteNodeRunner, p: Promise<(() => void) | undefined>) {
  const maps = getCache(runner)
  maps.queued.push(p)
  if (!maps.pending) {
    maps.pending = true
    await Promise.resolve()
    maps.pending = false
    const loading = [...maps.queued]
    maps.queued = []
    ;(await Promise.all(loading)).forEach(fn => fn && fn())
  }
}

async function fetchUpdate(runner: ViteNodeRunner, { path, acceptedPath }: Update) {
  path = normalizeRequestId(path)
  acceptedPath = normalizeRequestId(acceptedPath)

  const maps = getCache(runner)
  const mod = maps.hotModulesMap.get(path)

  if (!mod) {
    // In a code-splitting project,
    // it is common that the hot-updating module is not loaded yet.
    // https://github.com/vitejs/vite/issues/721
    return
  }

  const isSelfUpdate = path === acceptedPath
  let fetchedModule: ModuleNamespace | undefined

  // determine the qualified callbacks before we re-import the modules
  const qualifiedCallbacks = mod.callbacks.filter(({ deps }) =>
    deps.includes(acceptedPath),
  )

  if (isSelfUpdate || qualifiedCallbacks.length > 0) {
    const disposer = maps.disposeMap.get(acceptedPath)
    if (disposer)
      await disposer(maps.dataMap.get(acceptedPath))
    try {
      [fetchedModule] = await reload(runner, [acceptedPath])
    }
    catch (e: any) {
      warnFailedFetch(e, acceptedPath)
    }
  }

  return () => {
    for (const { deps, fn } of qualifiedCallbacks)
      fn(deps.map(dep => (dep === acceptedPath ? fetchedModule : undefined)))

    const loggedPath = isSelfUpdate ? path : `${acceptedPath} via ${path}`
    console.log(`${c.cyan('[vite-node]')} hot updated: ${loggedPath}`)
  }
}

function warnFailedFetch(err: Error, path: string | string[]) {
  if (!err.message.match('fetch'))
    console.error(err)

  console.error(
    `[hmr] Failed to reload ${path}. `
      + 'This could be due to syntax errors or importing non-existent '
      + 'modules. (see errors above)',
  )
}

export async function handleMessage(runner: ViteNodeRunner, emitter: HMREmitter, files: string[], payload: HMRPayload) {
  const maps = getCache(runner)
  switch (payload.type) {
    case 'connected':
      sendMessageBuffer(runner, emitter)
      break
    case 'update':
      await notifyListeners(runner, 'vite:beforeUpdate', payload)
      await Promise.all(payload.updates.map((update) => {
        if (update.type === 'js-update')
          return queueUpdate(runner, fetchUpdate(runner, update))

        // css-update
        console.error(`${c.cyan('[vite-node]')} no support css hmr.}`)
        return null
      }))
      await notifyListeners(runner, 'vite:afterUpdate', payload)
      break
    case 'full-reload':
      await notifyListeners(runner, 'vite:beforeFullReload', payload)
      maps.customListenersMap.delete('vite:beforeFullReload')
      await reload(runner, files)
      break
    case 'custom':
      await notifyListeners(runner, payload.event, payload.data)
      break
    case 'prune':
      await notifyListeners(runner, 'vite:beforePrune', payload)
      payload.paths.forEach((path) => {
        const fn = maps.pruneMap.get(path)
        if (fn)
          fn(maps.dataMap.get(path))
      })
      break
    case 'error': {
      await notifyListeners(runner, 'vite:error', payload)
      const err = payload.err
      console.error(`${c.cyan('[vite-node]')} Internal Server Error\n${err.message}\n${err.stack}`)
      break
    }
  }
}

export function createHotContext(
  runner: ViteNodeRunner,
  emitter: HMREmitter,
  files: string[],
  ownerPath: string,
): HotContext {
  debugHmr('createHotContext', ownerPath)
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

    acceptExports(_, callback?: any) {
      acceptDeps([ownerPath], callback && (([mod]) => callback(mod)))
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

    prune(cb: (data: any) => void) {
      maps.pruneMap.set(ownerPath, cb)
    },

    invalidate() {
      notifyListeners(runner, 'vite:invalidate', { path: ownerPath, message: undefined })
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

    off<T extends string>(
      event: T,
      cb: (payload: InferCustomEventPayload<T>) => void,
    ) {
      const removeFromMap = (map: Map<string, any[]>) => {
        const existing = map.get(event)
        if (existing === undefined)
          return

        const pruned = existing.filter(l => l !== cb)
        if (pruned.length === 0) {
          map.delete(event)
          return
        }
        map.set(event, pruned)
      }
      removeFromMap(maps.customListenersMap)
      removeFromMap(newListeners)
    },

    send<T extends string>(event: T, data?: InferCustomEventPayload<T>): void {
      maps.messageBuffer.push(JSON.stringify({ type: 'custom', event, data }))
      sendMessageBuffer(runner, emitter)
    },
  }

  return hot
}

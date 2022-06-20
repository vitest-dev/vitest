/* eslint-disable no-console */
import type { ErrorPayload, FullReloadPayload, HMRPayload, PrunePayload, Update, UpdatePayload } from 'vite/types/hmrPayload'
import { cyan } from 'kolorist'
import type { ViteNodeRunner } from '../client'
import { getCache } from './hotContext'
import type { HMREmitter } from './emitter'

export interface CustomEventMap {
  'vite:beforeUpdate': UpdatePayload
  'vite:beforePrune': PrunePayload
  'vite:beforeFullReload': FullReloadPayload
  'vite:error': ErrorPayload
}

export type InferCustomEventPayload<T extends string> =
  T extends keyof CustomEventMap ? CustomEventMap[T] : any

export function sendMessageBuffer(runner: ViteNodeRunner, emitter: HMREmitter) {
  const maps = getCache(runner)
  maps.messageBuffer.forEach(msg => emitter.emit('custom', msg))
  maps.messageBuffer.length = 0
}

export async function reload(runner: ViteNodeRunner, files: string[]) {
  // invalidate module cache but not node_modules
  Array.from(runner.moduleCache.keys())
    .forEach((i) => {
      if (!i.includes('node_modules'))
        runner.moduleCache.delete(i)
    })

  return Promise.all(files.map(file => runner.executeId(file)))
}

function notifyListeners<T extends string>(
  runner: ViteNodeRunner,
  event: T,
  data: InferCustomEventPayload<T>,
): void
function notifyListeners(runner: ViteNodeRunner, event: string, data: any): void {
  const maps = getCache(runner)
  const cbs = maps.customListenersMap.get(event)
  if (cbs)
    cbs.forEach(cb => cb(data))
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
  const maps = getCache(runner)
  const mod = maps.hotModulesMap.get(path)

  if (!mod) {
    // In a code-splitting project,
    // it is common that the hot-updating module is not loaded yet.
    // https://github.com/vitejs/vite/issues/721
    return
  }

  const moduleMap = new Map()
  const isSelfUpdate = path === acceptedPath

  // make sure we only import each dep once
  const modulesToUpdate = new Set<string>()
  if (isSelfUpdate) {
    // self update - only update self
    modulesToUpdate.add(path)
  }
  else {
    // dep update
    for (const { deps } of mod.callbacks) {
      deps.forEach((dep) => {
        if (acceptedPath === dep)
          modulesToUpdate.add(dep)
      })
    }
  }

  // determine the qualified callbacks before we re-import the modules
  const qualifiedCallbacks = mod.callbacks.filter(({ deps }) => {
    return deps.some(dep => modulesToUpdate.has(dep))
  })

  await Promise.all(
    Array.from(modulesToUpdate).map(async (dep) => {
      const disposer = maps.disposeMap.get(dep)
      if (disposer)
        await disposer(maps.dataMap.get(dep))
      try {
        const newMod = await reload(runner, [dep])
        moduleMap.set(dep, newMod)
      }
      catch (e: any) {
        warnFailedFetch(e, dep)
      }
    }),
  )

  return () => {
    for (const { deps, fn } of qualifiedCallbacks)
      fn(deps.map(dep => moduleMap.get(dep)))

    const loggedPath = isSelfUpdate ? path : `${acceptedPath} via ${path}`
    console.log(`${cyan('[vite-node]')} hot updated: ${loggedPath}`)
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
      notifyListeners(runner, 'vite:beforeUpdate', payload)
      if (maps.isFirstUpdate) {
        reload(runner, files)
        maps.isFirstUpdate = true
      }
      payload.updates.forEach((update) => {
        if (update.type === 'js-update') {
          queueUpdate(runner, fetchUpdate(runner, update))
        }
        else {
          // css-update
          console.error(`${cyan('[vite-node]')} no support css hmr.}`)
        }
      })
      break
    case 'full-reload':
      reload(runner, files)
      break
    case 'prune':
      payload.paths.forEach((path) => {
        const fn = maps.pruneMap.get(path)
        if (fn)
          fn(maps.dataMap.get(path))
      })
      break
    case 'error': {
      notifyListeners(runner, 'vite:error', payload)
      const err = payload.err
      console.error(`${cyan('[vite-node]')} Internal Server Error\n${err.message}\n${err.stack}`)
      break
    }
  }
}

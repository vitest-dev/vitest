import type { WorkerGlobalState } from 'vitest'
import type { CloneOption } from './types'
import { readFileSync as _readFileSync } from 'node:fs'
import ponyfillStructuredClone from '@ungap/structured-clone'
import createDebug from 'debug'

// keep the reference in case it was mocked
const readFileSync = _readFileSync

export const debug: createDebug.Debugger = createDebug('vitest:web-worker')

export function getWorkerState(): WorkerGlobalState {
  // @ts-expect-error untyped global
  return globalThis.__vitest_worker__
}

export function assertGlobalExists(name: string): void {
  if (!(name in globalThis)) {
    throw new Error(
      `[@vitest/web-worker] Cannot initiate a custom Web Worker. "${name}" is not supported in this environment. Please, consider using jsdom or happy-dom environment.`,
    )
  }
}

function createClonedMessageEvent(
  data: any,
  transferOrOptions: StructuredSerializeOptions | Transferable[] | undefined,
  clone: CloneOption,
) {
  const transfer = Array.isArray(transferOrOptions)
    ? transferOrOptions
    : transferOrOptions?.transfer

  debug('clone worker message %o', data)
  const origin = typeof location === 'undefined' ? undefined : location.origin

  if (typeof structuredClone === 'function' && clone === 'native') {
    debug('create message event, using native structured clone')
    return new MessageEvent('message', {
      data: structuredClone(data, { transfer }),
      origin,
    })
  }
  if (clone !== 'none') {
    debug('create message event, using polyfilled structured clone')
    if (transfer?.length) {
      console.warn(
        '[@vitest/web-worker] `structuredClone` is not supported in this environment. '
        + 'Falling back to polyfill, your transferable options will be lost. '
        + 'Set `VITEST_WEB_WORKER_CLONE` environmental variable to "none", if you don\'t want to loose it,'
        + 'or update to Node 17+.',
      )
    }
    return new MessageEvent('message', {
      data: ponyfillStructuredClone(data, { lossy: true } as any),
      origin,
    })
  }
  debug('create message event without cloning an object')
  return new MessageEvent('message', {
    data,
    origin,
  })
}

export function createMessageEvent(
  data: any,
  transferOrOptions: StructuredSerializeOptions | Transferable[] | undefined,
  clone: CloneOption,
): MessageEvent {
  try {
    return createClonedMessageEvent(data, transferOrOptions, clone)
  }
  catch (error) {
    debug('failed to clone message, dispatch "messageerror" event: %o', error)
    return new MessageEvent('messageerror', {
      data: error,
    })
  }
}

export function getRunnerOptions(): any {
  const state = getWorkerState()
  const { config, rpc, moduleCache, moduleExecutionInfo } = state

  return {
    async fetchModule(id: string) {
      const result = await rpc.fetch(id, 'web')
      if (result.id && !result.externalize) {
        const code = readFileSync(result.id, 'utf-8')
        return { code }
      }
      return result
    },
    resolveId(id: string, importer?: string) {
      return rpc.resolveId(id, importer, 'web')
    },
    moduleCache,
    moduleExecutionInfo,
    interopDefault: config.deps.interopDefault ?? true,
    moduleDirectories: config.deps.moduleDirectories,
    root: config.root,
    base: config.base,
    state,
  }
}

function stripProtocol(url: string | URL) {
  return url.toString().replace(/^file:\/+/, '/')
}

export function getFileIdFromUrl(url: URL | string): string {
  if (typeof self === 'undefined') {
    return stripProtocol(url)
  }
  if (!(url instanceof URL)) {
    url = new URL(url, self.location.origin)
  }
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    return url.pathname
  }
  return stripProtocol(url)
}

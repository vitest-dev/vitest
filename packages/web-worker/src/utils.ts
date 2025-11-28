import type { Debugger } from 'obug'
import type { WorkerGlobalState } from 'vitest'
import type { CloneOption } from './types'
import ponyfillStructuredClone from '@ungap/structured-clone'
import { createDebug } from 'obug'

export const debug: Debugger = createDebug('vitest:web-worker')

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
  const ports = transfer?.filter((t): t is MessagePort => t instanceof MessagePort)
  const transferWithoutPorts = transfer?.filter( // `ports` must be excluded from the `transfer` option passed to `structuredClone` to keep the MessagePort objects working correctly in the same thread.
    t => !(t instanceof MessagePort),
  )

  if (typeof structuredClone === 'function' && clone === 'native') {
    debug('create message event, using native structured clone')
    return new MessageEvent('message', {
      data: structuredClone(data, { transfer: transferWithoutPorts }),
      origin,
      ports,
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
      ports,
    })
  }
  debug('create message event without cloning an object')
  return new MessageEvent('message', {
    data,
    origin,
    ports,
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

import type { DefineWorkerOptions } from './types'
import { createSharedWorkerConstructor } from './shared-worker'
import { assertGlobalExists } from './utils'
import { createWorkerConstructor } from './worker'

export function defineWebWorkers(options?: DefineWorkerOptions) {
  if (
    typeof Worker === 'undefined'
    || !('__VITEST_WEB_WORKER__' in globalThis.Worker)
  ) {
    assertGlobalExists('EventTarget')
    assertGlobalExists('MessageEvent')

    globalThis.Worker = createWorkerConstructor(options)
  }

  if (
    typeof SharedWorker === 'undefined'
    || !('__VITEST_WEB_WORKER__' in globalThis.SharedWorker)
  ) {
    assertGlobalExists('EventTarget')

    globalThis.SharedWorker = createSharedWorkerConstructor()
  }
}

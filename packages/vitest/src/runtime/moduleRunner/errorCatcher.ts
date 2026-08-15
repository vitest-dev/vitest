import type { WorkerGlobalState } from '../../types/worker'
import { serializeValue } from '@vitest/utils/serialize'

// Store globals in case tests overwrite them
const processListeners = process.listeners.bind(process)
const processOn = process.on.bind(process)
const processOff = process.off.bind(process)

const dispose: (() => void)[] = []

// workerd reports `unhandledRejection` eagerly and fires `rejectionHandled` once a
// handler attaches later; Node defers the check until the microtask queue drains, so
// it never reports this case at all. Track reported promises so a late handler can retract them.
// The id only has to be unique within this worker: the main thread keys it by the
// worker's own RPC instance, so counters from different workers never collide.
let unhandledRejectionId = 0
const pendingRejections = new WeakMap<Promise<any>, number>()

export function listenForErrors(state: () => WorkerGlobalState): void {
  dispose.forEach(fn => fn())
  dispose.length = 0

  function catchError(err: any, type: string, event: 'uncaughtException' | 'unhandledRejection', promise?: Promise<any>) {
    const worker = state()

    const listeners = processListeners(event as 'uncaughtException')
    // if there is another listener, assume that it's handled by user code
    // one is Vitest's own listener
    if (listeners.length > 1) {
      return
    }

    const error = serializeValue(err)

    if (typeof error === 'object' && error != null) {
      error.VITEST_TEST_NAME = worker.current?.type === 'test' ? worker.current.name : undefined
      if (worker.filepath) {
        error.VITEST_TEST_PATH = worker.filepath
      }
    }

    let rejectionId: number | undefined
    if (promise) {
      rejectionId = unhandledRejectionId++
      pendingRejections.set(promise, rejectionId)
    }

    state().rpc.onUnhandledError(error, type, rejectionId)
  }

  const uncaughtException = (e: Error) => catchError(e, 'Uncaught Exception', 'uncaughtException')
  const unhandledRejection = (e: Error, promise: Promise<any>) => catchError(e, 'Unhandled Rejection', 'unhandledRejection', promise)
  const rejectionHandled = (promise: Promise<any>) => {
    const id = pendingRejections.get(promise)
    if (id != null) {
      pendingRejections.delete(promise)
      state().rpc.onUnhandledRejectionHandled(id)
    }
  }

  processOn('uncaughtException', uncaughtException)
  processOn('unhandledRejection', unhandledRejection)
  processOn('rejectionHandled', rejectionHandled)

  dispose.push(() => {
    processOff('uncaughtException', uncaughtException)
    processOff('unhandledRejection', unhandledRejection)
    processOff('rejectionHandled', rejectionHandled)
  })
}

import type { WorkerGlobalState } from '../../types/worker'
import { serializeValue } from '@vitest/utils/serialize'

const dispose: (() => void)[] = []

export function listenForErrors(state: () => WorkerGlobalState): void {
  dispose.forEach(fn => fn())
  dispose.length = 0

  function catchError(err: any, type: string, event: 'uncaughtException' | 'unhandledRejection') {
    const worker = state()

    const listeners = process.listeners(event as 'uncaughtException')
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
      error.VITEST_AFTER_ENV_TEARDOWN = worker.environmentTeardownRun
    }
    state().rpc.onUnhandledError(error, type)
  }

  const uncaughtException = (e: Error) => catchError(e, 'Uncaught Exception', 'uncaughtException')
  const unhandledRejection = (e: Error) => catchError(e, 'Unhandled Rejection', 'unhandledRejection')

  process.on('uncaughtException', uncaughtException)
  process.on('unhandledRejection', unhandledRejection)

  dispose.push(() => {
    process.off('uncaughtException', uncaughtException)
    process.off('unhandledRejection', unhandledRejection)
  })
}

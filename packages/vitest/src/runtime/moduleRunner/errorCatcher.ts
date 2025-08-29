import type { WorkerGlobalState } from '../../types/worker'

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

    const error = serializeError(err)

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

function serializeError(err: unknown, seen = new Map()) {
  if (seen.has(err)) {
    return seen.get(err)
  }
  const serializedError: any = {}
  seen.set(err, serializedError)

  if (!err || typeof err !== 'object') {
    serializedError.message = String(err)
    return serializedError
  }

  if ('message' in err) {
    serializedError.message = String(err.message)
  }
  if ('stack' in err) {
    serializedError.message = String(err.stack)
  }
  if ('name' in err) {
    serializedError.message = String(err.name)
  }
  if ('cause' in err) {
    serializedError.message = serializeError(err.cause, seen)
  }
  return serializedError
}

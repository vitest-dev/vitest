import type { client } from './client'
import { channel } from './client'
import { getBrowserState, importId } from './utils'

function on(event: string, listener: (...args: any[]) => void) {
  window.addEventListener(event, listener)
  return () => window.removeEventListener(event, listener)
}

export function serializeError(unhandledError: any) {
  return {
    ...unhandledError,
    name: unhandledError.name,
    message: unhandledError.message,
    stack: String(unhandledError.stack),
  }
}

// we can't import "processError" yet because error might've been thrown before the module was loaded
async function defaultErrorReport(type: string, unhandledError: any) {
  const error = serializeError(unhandledError)
  channel.postMessage({
    type: 'error',
    files: getBrowserState().runningFiles,
    error,
    errorType: type,
    id: getBrowserState().iframeId!,
  })
}

function catchWindowErrors(cb: (e: ErrorEvent) => void) {
  let userErrorListenerCount = 0
  function throwUnhandlerError(e: ErrorEvent) {
    if (userErrorListenerCount === 0 && e.error != null) {
      cb(e)
    }
    else {
      console.error(e.error)
    }
  }
  const addEventListener = window.addEventListener.bind(window)
  const removeEventListener = window.removeEventListener.bind(window)
  window.addEventListener('error', throwUnhandlerError)
  window.addEventListener = function (
    ...args: Parameters<typeof addEventListener>
  ) {
    if (args[0] === 'error') {
      userErrorListenerCount++
    }
    return addEventListener.apply(this, args)
  }
  window.removeEventListener = function (
    ...args: Parameters<typeof removeEventListener>
  ) {
    if (args[0] === 'error' && userErrorListenerCount) {
      userErrorListenerCount--
    }
    return removeEventListener.apply(this, args)
  }
  return function clearErrorHandlers() {
    window.removeEventListener('error', throwUnhandlerError)
  }
}

export function registerUnhandledErrors() {
  const stopErrorHandler = catchWindowErrors(e =>
    defaultErrorReport('Error', e.error),
  )
  const stopRejectionHandler = on('unhandledrejection', e =>
    defaultErrorReport('Unhandled Rejection', e.reason))
  return () => {
    stopErrorHandler()
    stopRejectionHandler()
  }
}

export function registerUnexpectedErrors(rpc: typeof client.rpc) {
  catchWindowErrors(event =>
    reportUnexpectedError(rpc, 'Error', event.error),
  )
  on('unhandledrejection', event =>
    reportUnexpectedError(rpc, 'Unhandled Rejection', event.reason))
}

async function reportUnexpectedError(
  rpc: typeof client.rpc,
  type: string,
  error: any,
) {
  const { processError } = (await importId(
    'vitest/browser',
  )) as typeof import('vitest/browser')
  const processedError = processError(error)
  await rpc.onUnhandledError(processedError, type)
}

import { client } from '@vitest/browser/client'

function on(event: string, listener: (...args: any[]) => void) {
  window.addEventListener(event, listener)
  return () => window.removeEventListener(event, listener)
}

function serializeError(unhandledError: any) {
  if (typeof unhandledError !== 'object' || !unhandledError) {
    return {
      message: String(unhandledError),
    }
  }

  return {
    name: unhandledError.name,
    message: unhandledError.message,
    stack: String(unhandledError.stack),
  }
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
    ...args: [any, any, any]
  ) {
    if (args[0] === 'error') {
      userErrorListenerCount++
    }
    return addEventListener.apply(this, args)
  }
  window.removeEventListener = function (
    ...args: [any, any, any]
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

function registerUnexpectedErrors() {
  catchWindowErrors(event =>
    reportUnexpectedError('Error', event.error),
  )
  on('unhandledrejection', event =>
    reportUnexpectedError('Unhandled Rejection', event.reason))
}

async function reportUnexpectedError(
  type: string,
  error: any,
) {
  const processedError = serializeError(error)
  await client.rpc.onUnhandledError(processedError, type)
}

registerUnexpectedErrors()

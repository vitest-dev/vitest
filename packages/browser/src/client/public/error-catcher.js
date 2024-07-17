import { channel, client } from '@vitest/browser/client'

function on(event, listener) {
  window.addEventListener(event, listener)
  return () => window.removeEventListener(event, listener)
}

function serializeError(unhandledError) {
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

function catchWindowErrors(cb) {
  let userErrorListenerCount = 0
  function throwUnhandlerError(e) {
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
  window.addEventListener = function (...args) {
    if (args[0] === 'error') {
      userErrorListenerCount++
    }
    return addEventListener.apply(this, args)
  }
  window.removeEventListener = function (...args) {
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
  type,
  error,
) {
  const processedError = serializeError(error)
  await client.rpc.onUnhandledError(processedError, type)
  const state = __vitest_browser_runner__

  if (state.type === 'orchestrator') {
    return
  }

  if (!state.runTests || !__vitest_worker__.current) {
    channel.postMessage({
      type: 'done',
      filenames: state.files,
      id: state.iframeId,
    })
  }
}

registerUnexpectedErrors()

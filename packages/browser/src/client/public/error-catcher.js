import { channel, client } from '@vitest/browser/client'

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

function catchWindowErrors(errorEvent, prop, cb) {
  let userErrorListenerCount = 0
  function throwUnhandlerError(e) {
    if (userErrorListenerCount === 0 && e[prop] != null) {
      cb(e)
    }
    else {
      console.error(e[prop])
    }
  }
  const addEventListener = window.addEventListener.bind(window)
  const removeEventListener = window.removeEventListener.bind(window)
  window.addEventListener(errorEvent, throwUnhandlerError)
  window.addEventListener = function (...args) {
    if (args[0] === errorEvent) {
      userErrorListenerCount++
    }
    return addEventListener.apply(this, args)
  }
  window.removeEventListener = function (...args) {
    if (args[0] === errorEvent && userErrorListenerCount) {
      userErrorListenerCount--
    }
    return removeEventListener.apply(this, args)
  }
  return function clearErrorHandlers() {
    window.removeEventListener(errorEvent, throwUnhandlerError)
  }
}

function registerUnexpectedErrors() {
  catchWindowErrors('error', 'error', event =>
    reportUnexpectedError('Error', event.error))
  catchWindowErrors('unhandledrejection', 'reason', event =>
    reportUnexpectedError('Unhandled Rejection', event.reason))
}

async function reportUnexpectedError(
  type,
  error,
) {
  const processedError = serializeError(error)
  await client.waitForConnection().then(() => {
    return client.rpc.onUnhandledError(processedError, type)
  }).catch(console.error)
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

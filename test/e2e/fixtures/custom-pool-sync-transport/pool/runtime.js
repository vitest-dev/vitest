import { parentPort } from 'node:worker_threads'
import { init, runBaseTests, setupEnvironment } from 'vitest/worker'

const handlers = new Set()
const buffered = []

parentPort.on('message', (message) => {
  if (handlers.size === 0) {
    buffered.push(message)
    return
  }
  for (const handler of handlers) {
    handler(message)
  }
})

// Connect only once a message is already waiting, then hand the queue over
// synchronously from inside `on()`, the way a synchronous transport does.
parentPort.once('message', () => {
  init({
    post: response => parentPort.postMessage(response),
    on: (callback) => {
      handlers.add(callback)
      for (const message of buffered.splice(0)) {
        callback(message)
      }
    },
    off: callback => handlers.delete(callback),
    teardown: () => handlers.clear(),
    runTests: (state, traces) => runBaseTests('run', state, traces),
    collectTests: (state, traces) => runBaseTests('collect', state, traces),
    setup: setupEnvironment,
  })
})

import type { WorkerGlobalState } from '../../types/worker'
import { isMainThread, parentPort } from 'node:worker_threads'
import { createDisposer, init } from './init'

if (isMainThread || !parentPort) {
  throw new Error('Expected worker to be run in node:worker_threads')
}

export default function workerInit(options: {
  runTests: (method: 'run' | 'collect', state: WorkerGlobalState) => Promise<void>
}): void {
  const { runTests } = options

  // RPC listeners of previous run
  const disposer = createDisposer()

  init({
    send: response => parentPort!.postMessage(response),
    subscribe: callback => parentPort!.on('message', callback),
    off: callback => parentPort!.off('message', callback),

    worker: {
      post: v => parentPort!.postMessage(v),
      on: (fn) => {
        parentPort!.addListener('message', fn)
        disposer.on(() => parentPort!.off('message', fn))
      },
      runTests: async (state) => {
        await runTests('run', state)
        disposer.clear()
      },
      collectTests: async (state) => {
        await runTests('collect', state)
        disposer.clear()
      },
    },
  })
}

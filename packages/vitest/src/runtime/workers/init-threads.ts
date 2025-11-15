import type { WorkerGlobalState, WorkerSetupContext } from '../../types/worker'
import { isMainThread, parentPort } from 'node:worker_threads'
import { init } from './init'

if (isMainThread || !parentPort) {
  throw new Error('Expected worker to be run in node:worker_threads')
}

export default function workerInit(options: {
  runTests: (method: 'run' | 'collect', state: WorkerGlobalState) => Promise<void>
  setup?: (context: WorkerSetupContext) => Promise<() => Promise<unknown>>
}): void {
  const { runTests } = options

  init({
    post: response => parentPort!.postMessage(response),
    on: callback => parentPort!.on('message', callback),
    off: callback => parentPort!.off('message', callback),
    teardown: () => parentPort!.removeAllListeners('message'),
    runTests: async state => runTests('run', state),
    collectTests: async state => runTests('collect', state),
    setup: options.setup,
  })
}

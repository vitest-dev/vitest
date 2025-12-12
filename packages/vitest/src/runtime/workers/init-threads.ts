import type { WorkerGlobalState, WorkerSetupContext } from '../../types/worker'
import type { Traces } from '../../utils/traces'
import { isMainThread, parentPort } from 'node:worker_threads'
import { init } from './init'

if (isMainThread || !parentPort) {
  throw new Error('Expected worker to be run in node:worker_threads')
}

export default function workerInit(options: {
  runTests: (method: 'run' | 'collect', state: WorkerGlobalState, traces: Traces) => Promise<void>
  setup?: (context: WorkerSetupContext) => void | Promise<() => Promise<unknown>>
}): void {
  const { runTests } = options

  init({
    post: response => parentPort!.postMessage(response),
    on: callback => parentPort!.on('message', callback),
    off: callback => parentPort!.off('message', callback),
    teardown: () => parentPort!.removeAllListeners('message'),
    runTests: async (state, traces) => runTests('run', state, traces),
    collectTests: async (state, traces) => runTests('collect', state, traces),
    setup: options.setup,
  })
}

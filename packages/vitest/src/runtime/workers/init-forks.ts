import type { WorkerGlobalState, WorkerSetupContext } from '../../types/worker'
import type { Traces } from '../../utils/traces'
import { init } from './init'

if (!process.send) {
  throw new Error('Expected worker to be run in node:child_process')
}

// Store globals in case tests overwrite them
const processExit = process.exit.bind(process)
const processSend = process.send.bind(process)
const processOn = process.on.bind(process)
const processOff = process.off.bind(process)
const processRemoveAllListeners = process.removeAllListeners.bind(process)

const isProfiling = process.execArgv.some(
  execArg =>
    execArg.startsWith('--prof')
    || execArg.startsWith('--cpu-prof')
    || execArg.startsWith('--heap-prof')
    || execArg.startsWith('--diagnostic-dir'),
)

// Work-around for nodejs/node#55094
if (isProfiling) {
  processOn('SIGTERM', () => processExit())
}

processOn('error', onError)

export default function workerInit(options: {
  runTests: (method: 'run' | 'collect', state: WorkerGlobalState, traces: Traces) => Promise<void>
  setup?: (context: WorkerSetupContext) => void | Promise<() => Promise<unknown>>
}): void {
  const { runTests } = options

  init({
    post: v => processSend(v),
    on: cb => processOn('message', cb),
    off: cb => processOff('message', cb),
    teardown: () => {
      processRemoveAllListeners('message')
      processOff('error', onError)
    },
    runTests: (state, traces) => executeTests('run', state, traces),
    collectTests: (state, traces) => executeTests('collect', state, traces),
    setup: options.setup,
  })

  async function executeTests(method: 'run' | 'collect', state: WorkerGlobalState, traces: Traces) {
    try {
      await runTests(method, state, traces)
    }
    finally {
      process.exit = processExit
    }
  }
}

// Prevent leaving worker in loops where it tries to send message to closed main
// thread, errors, and tries to send the error.
function onError(error: any) {
  if (error?.code === 'ERR_IPC_CHANNEL_CLOSED' || error?.code === 'EPIPE') {
    processExit(1)
  }
}

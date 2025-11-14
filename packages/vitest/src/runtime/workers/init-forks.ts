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

export default function workerInit(options: {
  runTests: (method: 'run' | 'collect', state: WorkerGlobalState, otel: Traces) => Promise<void>
  setup?: (context: WorkerSetupContext) => Promise<() => Promise<unknown>>
}): void {
  const { runTests } = options

  init({
    post: v => processSend(v),
    on: cb => processOn('message', cb),
    off: cb => processOff('message', cb),
    teardown: () => processRemoveAllListeners('message'),
    runTests: (state, otel) => executeTests('run', state, otel),
    collectTests: (state, otel) => executeTests('run', state, otel),
    setup: options.setup,
  })

  async function executeTests(method: 'run' | 'collect', state: WorkerGlobalState, otel: Traces) {
    try {
      await runTests(method, state, otel)
    }
    finally {
      process.exit = processExit
    }
  }
}

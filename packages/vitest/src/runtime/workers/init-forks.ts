import type { ResolvedConfig, SerializedConfig } from '../../node/types/config'
import type { WorkerGlobalState } from '../../types/worker'
import v8 from 'node:v8'
import { createDisposer, init } from './init'

if (!process.send) {
  throw new Error('Expected worker to be run in node:child_process')
}

// Store globals in case tests overwrite them
const processExit = process.exit.bind(process)
const processSend = process.send.bind(process)
const processOn = process.on.bind(process)
const processOff = process.off.bind(process)

// TODO: Should we do `process.send = undefined` to make test files not see that they are in child_process?

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
  runTests: (method: 'run' | 'collect', state: WorkerGlobalState) => Promise<void>
}): void {
  const { runTests } = options

  // RPC listeners of previous run
  const disposer = createDisposer()

  init({
    send: response => processSend(v8.serialize(response)),
    subscribe: callback => processOn('message', (message: string) => callback(v8.deserialize(Buffer.from(message)))),
    off: callback => processOff('message', callback),

    worker: {
      serialize: v8.serialize,
      deserialize: v => v8.deserialize(Buffer.from(v)),
      post: v => processSend!(v),
      on: (fn) => {
        const handler = (message: any, ...extras: any) => {
          return fn(message, ...extras)
        }
        processOn('message', handler)
        disposer.on(() => processOff('message', handler))
      },
      runTests: state => executeTests('run', state),
      collectTests: state => executeTests('collect', state),
    },
  })

  async function executeTests(method: 'run' | 'collect', state: WorkerGlobalState) {
    state.ctx.config = unwrapSerializableConfig(state.ctx.config)

    try {
      await runTests(method, state)
      disposer.clear()
    }
    finally {
      process.exit = processExit
    }
  }
}

/**
 * Reverts the wrapping done by `wrapSerializableConfig` in {@link file://./../../node/pool/runtimes/forks.ts}
 */
function unwrapSerializableConfig(config: SerializedConfig): SerializedConfig {
  if (config.testNamePattern && typeof config.testNamePattern === 'string') {
    const testNamePattern = config.testNamePattern as string

    if (testNamePattern.startsWith('$$vitest:')) {
      config.testNamePattern = parseRegexp(testNamePattern.slice('$$vitest:'.length))
    }
  }

  if (
    config.defines
    && Array.isArray(config.defines.keys)
    && config.defines.original
  ) {
    const { keys, original } = config.defines
    const defines: ResolvedConfig['defines'] = {}

    // Apply all keys from the original. Entries which had undefined value are missing from original now
    for (const key of keys) {
      defines[key] = original[key]
    }

    config.defines = defines
  }

  return config
}

function parseRegexp(input: string): RegExp {
  // Parse input
  // eslint-disable-next-line regexp/no-misleading-capturing-group
  const m = input.match(/(\/?)(.+)\1([a-z]*)/i)

  // match nothing
  if (!m) {
    return /$^/
  }

  // Invalid flags
  // eslint-disable-next-line regexp/optimal-quantifier-concatenation
  if (m[3] && !/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(m[3])) {
    return new RegExp(input)
  }

  // Create the regular expression
  return new RegExp(m[2], m[3])
}

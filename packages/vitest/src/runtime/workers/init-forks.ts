import type { ResolvedConfig, SerializedConfig } from '../../node/types/config'
import type { WorkerGlobalState, WorkerSetupContext } from '../../types/worker'
import type { Traces } from '../../utils/traces'
import v8 from 'node:v8'
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
    serialize: v8.serialize,
    deserialize: v => v8.deserialize(Buffer.from(v)),
    runTests: (state, otel) => executeTests('run', state, otel),
    collectTests: (state, otel) => executeTests('collect', state, otel),
    setup: options.setup,
  })

  async function executeTests(method: 'run' | 'collect', state: WorkerGlobalState, otel: Traces) {
    state.ctx.config = unwrapSerializableConfig(state.ctx.config)

    try {
      await runTests(method, state, otel)
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

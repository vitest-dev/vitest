import { createRequire } from 'node:module'
import type { ContextRPC } from '../types/worker'
import type { SerializedConfig } from './config'

const __require = createRequire(import.meta.url)
let inspector: typeof import('node:inspector')
let session: InstanceType<typeof inspector.Session>

/**
 * Enables debugging inside `worker_threads` and `child_process`.
 * Should be called as early as possible when worker/process has been set up.
 */
export function setupInspect(ctx: ContextRPC) {
  const config = ctx.config
  const isEnabled = config.inspector.enabled

  if (isEnabled) {
    inspector = __require('node:inspector')
    // Inspector may be open already if "isolate: false" is used
    const isOpen = inspector.url() !== undefined

    if (!isOpen) {
      inspector.open(
        config.inspector.port,
        config.inspector.host,
        config.inspector.waitForDebugger,
      )
    }
  }

  const keepOpen = shouldKeepOpen(config)

  return function cleanup() {
    if (isEnabled && !keepOpen && inspector) {
      inspector.close()
      session?.disconnect()
    }
  }
}

export function closeInspector(config: SerializedConfig) {
  const keepOpen = shouldKeepOpen(config)

  if (inspector && !keepOpen) {
    inspector.close()
    session?.disconnect()
  }
}

function shouldKeepOpen(config: SerializedConfig) {
  // In watch mode the inspector can persist re-runs if isolation is disabled and a single worker is used
  const isIsolatedSingleThread
    = config.pool === 'threads'
    && config.poolOptions?.threads?.isolate === false
    && config.poolOptions?.threads?.singleThread
  const isIsolatedSingleFork
    = config.pool === 'forks'
    && config.poolOptions?.forks?.isolate === false
    && config.poolOptions?.forks?.singleFork

  return config.watch && (isIsolatedSingleFork || isIsolatedSingleThread)
}

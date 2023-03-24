import inspector from 'node:inspector'

import type { ResolvedConfig } from '../types'

/**
 * Enables debugging inside `worker_threads` and `child_process`.
 * Should be called as early as possible when worker/process has been set up.
 */
export function setupInspect(config: ResolvedConfig) {
  const isEnabled = config.inspect || config.inspectBrk

  if (isEnabled) {
    // Inspector may be open already if "isolate: false" is used
    const isOpen = inspector.url() !== undefined

    if (!isOpen) {
      inspector.open()

      if (config.inspectBrk)
        inspector.waitForDebugger()
    }
  }

  // In watch mode the inspector can persist re-runs if "isolate: false, singleThread: true" is used
  const keepOpen = config.watch && !config.isolate && config.singleThread

  return function cleanup() {
    if (isEnabled && !keepOpen)
      inspector.close()
  }
}

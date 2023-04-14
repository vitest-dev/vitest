import { createRequire } from 'node:module'

import type { ResolvedConfig } from '../types'

const __require = createRequire(import.meta.url)
let inspector: typeof import('node:inspector')

/**
 * Enables debugging inside `worker_threads` and `child_process`.
 * Should be called as early as possible when worker/process has been set up.
 */
export function setupInspect(config: ResolvedConfig) {
  const isEnabled = config.inspect || config.inspectBrk

  if (isEnabled) {
    inspector = __require('node:inspector')
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
    if (isEnabled && !keepOpen && inspector)
      inspector.close()
  }
}

import { setSafeTimers } from '@vitest/utils'
import { resetRunOnceCounter } from '../integrations/run-once'
import type { ResolvedConfig } from '../types'

let globalSetup = false
export async function setupCommonEnv(config: ResolvedConfig) {
  resetRunOnceCounter()
  setupDefines(config.defines)

  if (globalSetup)
    return

  setSafeTimers()
  globalSetup = true

  if (config.globals)
    (await import('../integrations/globals')).registerApiGlobally()
}

function setupDefines(defines: Record<string, any>) {
  for (const key in defines)
    (globalThis as any)[key] = defines[key]
}

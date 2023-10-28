import { setSafeTimers } from '@vitest/utils'
import { resetRunOnceCounter } from '../integrations/run-once'
import type { ResolvedConfig } from '../types'
import type { DiffOptions } from '../types/matcher-utils'
import type { VitestExecutor } from './execute'

let globalSetup = false
export async function setupCommonEnv(config: ResolvedConfig) {
  resetRunOnceCounter()
  setupDefines(config.defines)

  if (globalSetup)
    return

  globalSetup = true
  setSafeTimers()

  if (config.globals)
    (await import('../integrations/globals')).registerApiGlobally()
}

function setupDefines(defines: Record<string, any>) {
  for (const key in defines)
    (globalThis as any)[key] = defines[key]
}

export async function loadDiffConfig(config: ResolvedConfig, executor: VitestExecutor) {
  if (typeof config.diff !== 'string')
    return

  const diffModule = await executor.executeId(config.diff)

  if (diffModule && typeof diffModule.default === 'object' && diffModule.default != null)
    return diffModule.default as DiffOptions
  else
    throw new Error(`invalid diff config file ${config.diff}. Must have a default export with config object`)
}

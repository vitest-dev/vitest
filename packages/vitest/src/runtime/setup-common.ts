import type { DiffOptions } from '@vitest/expect'
import type { SnapshotSerializer } from '@vitest/snapshot'
import type { SerializedConfig } from './config'
import type { VitestExecutor } from './execute'
import { addSerializer } from '@vitest/snapshot'
import { setSafeTimers } from '@vitest/utils'
import { resetRunOnceCounter } from '../integrations/run-once'

let globalSetup = false
export async function setupCommonEnv(config: SerializedConfig) {
  resetRunOnceCounter()
  setupDefines(config.defines)
  setupEnv(config.env)

  if (globalSetup) {
    return
  }

  globalSetup = true
  setSafeTimers()

  if (config.globals) {
    (await import('../integrations/globals')).registerApiGlobally()
  }
}

function setupDefines(defines: Record<string, any>) {
  for (const key in defines) {
    (globalThis as any)[key] = defines[key]
  }
}

function setupEnv(env: Record<string, any>) {
  if (typeof process === 'undefined') {
    return
  }
  // same boolean-to-string assignment as VitestPlugin.configResolved
  const { PROD, DEV, ...restEnvs } = env
  process.env.PROD = PROD ? '1' : ''
  process.env.DEV = DEV ? '1' : ''
  for (const key in restEnvs) {
    process.env[key] = env[key]
  }
}

export async function loadDiffConfig(
  config: SerializedConfig,
  executor: VitestExecutor,
) {
  if (typeof config.diff === 'object') {
    return config.diff
  }
  if (typeof config.diff !== 'string') {
    return
  }

  const diffModule = await executor.executeId(config.diff)

  if (
    diffModule
    && typeof diffModule.default === 'object'
    && diffModule.default != null
  ) {
    return diffModule.default as DiffOptions
  }
  else {
    throw new Error(
      `invalid diff config file ${config.diff}. Must have a default export with config object`,
    )
  }
}

export async function loadSnapshotSerializers(
  config: SerializedConfig,
  executor: VitestExecutor,
) {
  const files = config.snapshotSerializers

  const snapshotSerializers = await Promise.all(
    files.map(async (file) => {
      const mo = await executor.executeId(file)
      if (!mo || typeof mo.default !== 'object' || mo.default === null) {
        throw new Error(
          `invalid snapshot serializer file ${file}. Must export a default object`,
        )
      }

      const config = mo.default
      if (
        typeof config.test !== 'function'
        || (typeof config.serialize !== 'function'
          && typeof config.print !== 'function')
      ) {
        throw new TypeError(
          `invalid snapshot serializer in ${file}. Must have a 'test' method along with either a 'serialize' or 'print' method.`,
        )
      }

      return config as SnapshotSerializer
    }),
  )

  snapshotSerializers.forEach(serializer => addSerializer(serializer))
}

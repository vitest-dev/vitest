import type { DiffOptions } from '@vitest/expect'
import type { SnapshotSerializer } from '@vitest/snapshot'
import type { SerializedDiffOptions } from '@vitest/utils/diff'
import type { SerializedConfig } from './config'
import type { PublicModuleRunner } from './moduleRunner/types'
import { addSerializer } from '@vitest/snapshot'
import { setSafeTimers } from '@vitest/utils/timers'

let globalSetup = false
export async function setupCommonEnv(config: SerializedConfig): Promise<void> {
  setupDefines(config)

  if (globalSetup) {
    return
  }

  globalSetup = true
  setSafeTimers()

  if (config.globals) {
    (await import('../integrations/globals')).registerApiGlobally()
  }
}

function setupDefines(config: SerializedConfig) {
  for (const key in config.defines) {
    (globalThis as any)[key] = config.defines[key]
  }
}

export function setupEnv(env: Record<string, any>, metaEnv: Record<string, any>): void {
  for (const key in env) {
    metaEnv[key] = env[key]
  }
}

export async function loadDiffConfig(
  config: SerializedConfig,
  moduleRunner: PublicModuleRunner,
): Promise<SerializedDiffOptions | undefined> {
  if (typeof config.diff === 'object') {
    return config.diff
  }
  if (typeof config.diff !== 'string') {
    return
  }

  const diffModule = await moduleRunner.import(config.diff)

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
  moduleRunner: PublicModuleRunner,
): Promise<void> {
  const files = config.snapshotSerializers

  const snapshotSerializers = await Promise.all(
    files.map(async (file) => {
      const mo = await moduleRunner.import(file)
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

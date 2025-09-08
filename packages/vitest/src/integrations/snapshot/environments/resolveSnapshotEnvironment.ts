import type { SnapshotEnvironment } from '@vitest/snapshot/environment'
import type { SerializedConfig } from '../../../runtime/config'
import type { VitestModuleRunner } from '../../../runtime/moduleRunner/moduleRunner'

export async function resolveSnapshotEnvironment(
  config: SerializedConfig,
  executor: VitestModuleRunner,
): Promise<SnapshotEnvironment> {
  if (!config.snapshotEnvironment) {
    const { VitestNodeSnapshotEnvironment } = await import('./node')
    return new VitestNodeSnapshotEnvironment()
  }

  const mod = await executor.import(config.snapshotEnvironment)
  if (typeof mod.default !== 'object' || !mod.default) {
    throw new Error(
      'Snapshot environment module must have a default export object with a shape of `SnapshotEnvironment`',
    )
  }
  return mod.default
}

import type { SnapshotEnvironment } from '@vitest/snapshot/environment'
import type { SerializedConfig } from '../../../runtime/config'
import type { VitestExecutor } from '../../../runtime/execute'

export async function resolveSnapshotEnvironment(
  config: SerializedConfig,
  executor: VitestExecutor,
): Promise<SnapshotEnvironment> {
  if (!config.snapshotEnvironment) {
    const { VitestNodeSnapshotEnvironment } = await import('./node')
    return new VitestNodeSnapshotEnvironment()
  }

  const mod = await executor.executeId(config.snapshotEnvironment)
  if (typeof mod.default !== 'object' || !mod.default) {
    throw new Error(
      'Snapshot environment module must have a default export object with a shape of `SnapshotEnvironment`',
    )
  }
  return mod.default
}

import type { SnapshotEnvironment } from '@vitest/snapshot/environment'
import type { SerializedConfig } from '../../../runtime/config'
import type { TestModuleRunner } from '../../../runtime/moduleRunner/testModuleRunner'

export async function resolveSnapshotEnvironment(
  config: SerializedConfig,
  moduleRunner: TestModuleRunner,
): Promise<SnapshotEnvironment> {
  if (!config.snapshotEnvironment) {
    const { VitestNodeSnapshotEnvironment } = await import('./node')
    return new VitestNodeSnapshotEnvironment()
  }

  const mod = await moduleRunner.import(config.snapshotEnvironment)
  if (typeof mod.default !== 'object' || !mod.default) {
    throw new Error(
      'Snapshot environment module must have a default export object with a shape of `SnapshotEnvironment`',
    )
  }
  return mod.default
}

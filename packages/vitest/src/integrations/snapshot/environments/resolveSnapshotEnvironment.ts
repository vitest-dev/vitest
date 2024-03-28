import type { SnapshotEnvironment } from '@vitest/snapshot/environment'
import type { VitestExecutor } from '../../../runtime/execute'
import type { ResolvedConfig } from '../../../types'
import { VitestSnapshotEnvironment } from './node'

export async function resolveSnapshotEnvironment(
  config: ResolvedConfig,
  executor: VitestExecutor,
): Promise<SnapshotEnvironment> {
  if (!config.snapshotEnvironment)
    return new VitestSnapshotEnvironment()

  const mod = await executor.executeId(config.snapshotEnvironment)
  if (typeof mod.default !== 'object' && !mod.default)
    throw new Error('Snapshot environment module must have a default export object with a shape of `SnapshotEnvironment`')
  return mod.default
}

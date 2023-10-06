import { NodeSnapshotEnvironment } from '@vitest/snapshot/environment'
import type { WorkerRPC } from '../../../types/worker'

export class VitestSnapshotEnvironment extends NodeSnapshotEnvironment {
  constructor(private rpc: WorkerRPC) {
    super()
  }

  getHeader(): string {
    return `// Vitest Snapshot v${this.getVersion()}, https://vitest.dev/guide/snapshot.html`
  }

  resolvePath(filepath: string): Promise<string> {
    return this.rpc.resolveSnapshotPath(filepath)
  }
}

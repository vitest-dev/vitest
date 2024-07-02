import { NodeSnapshotEnvironment } from '@vitest/snapshot/environment'
import { getWorkerState } from '../../../utils'

export class VitestNodeSnapshotEnvironment extends NodeSnapshotEnvironment {
  getHeader(): string {
    return `// Vitest Snapshot v${this.getVersion()}, https://vitest.dev/guide/snapshot.html`
  }

  resolvePath(filepath: string): Promise<string> {
    const rpc = getWorkerState().rpc
    return rpc.resolveSnapshotPath(filepath)
  }
}

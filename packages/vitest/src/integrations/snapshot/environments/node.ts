import { NodeSnapshotEnvironment } from '@vitest/snapshot/environment'
import { rpc } from '../../../runtime/rpc'

export class VitestSnapshotEnvironment extends NodeSnapshotEnvironment {
  getHeader(): string {
    return `// Vitest Snapshot v${this.getVersion()}, https://vitest.dev/guide/snapshot.html`
  }

  resolvePath(filepath: string): Promise<string> {
    return rpc().resolveSnapshotPath(filepath)
  }
}

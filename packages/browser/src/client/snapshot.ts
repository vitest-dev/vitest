import type { SnapshotEnvironment } from 'vitest'
import { rpc } from './rpc'

export class BrowserSnapshotEnvironment implements SnapshotEnvironment {
  getVersion(): string {
    return '1'
  }

  getHeader(): string {
    return `// Vitest Snapshot v${this.getVersion()}, https://vitest.dev/guide/snapshot.html`
  }

  readSnapshotFile(filepath: string): Promise<string | null> {
    return rpc().readSnapshotFile(filepath)
  }

  saveSnapshotFile(filepath: string, snapshot: string): Promise<void> {
    return rpc().saveSnapshotFile(filepath, snapshot)
  }

  resolvePath(filepath: string): Promise<string> {
    return rpc().resolveSnapshotPath(filepath)
  }

  resolveRawPath(testPath: string, rawPath: string): Promise<string> {
    return rpc().resolveSnapshotRawPath(testPath, rawPath)
  }

  removeSnapshotFile(filepath: string): Promise<void> {
    return rpc().removeSnapshotFile(filepath)
  }
}

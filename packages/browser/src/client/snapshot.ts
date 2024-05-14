import type { VitestClient } from '@vitest/ws-client'
import type { SnapshotEnvironment } from 'vitest/snapshot'

export class VitestBrowserSnapshotEnvironment implements SnapshotEnvironment {
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

function rpc(): VitestClient['rpc'] {
  // @ts-expect-error not typed global
  return globalThis.__vitest_worker__.rpc
}

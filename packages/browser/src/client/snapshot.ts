import type { VitestClient } from '@vitest/ws-client'
import type { SnapshotEnvironment } from '#types'

export class BrowserSnapshotEnvironment implements SnapshotEnvironment {
  constructor(private client: VitestClient) {}

  readSnapshotFile(filepath: string): Promise<string | null> {
    return this.client.rpc.readFile(filepath)
  }

  saveSnapshotFile(filepath: string, snapshot: string): Promise<void> {
    return this.client.rpc.writeFile(filepath, snapshot)
  }

  resolvePath(filepath: string): Promise<string> {
    return this.client.rpc.resolveSnapshotPath(filepath)
  }

  removeSnapshotFile(filepath: string): Promise<void> {
    return this.client.rpc.removeFile(filepath)
  }

  async prepareDirectory(filepath: string): Promise<void> {
    await this.client.rpc.createDirectory(filepath)
  }
}

import { existsSync, promises as fs } from 'node:fs'
import { rpc } from '../../../runtime/rpc'
import type { SnapshotEnvironment } from '../env'

export class NodeSnapshotEnvironment implements SnapshotEnvironment {
  resolvePath(filepath: string): Promise<string> {
    return rpc().resolveSnapshotPath(filepath)
  }

  async prepareDirectory(filepath: string): Promise<void> {
    await fs.mkdir(filepath, { recursive: true })
  }

  async saveSnapshotFile(filepath: string, snapshot: string): Promise<void> {
    await fs.writeFile(filepath, snapshot, 'utf-8')
  }

  async readSnapshotFile(filepath: string): Promise<string | null> {
    if (!existsSync(filepath))
      return null
    return fs.readFile(filepath, 'utf-8')
  }

  async removeSnapshotFile(filepath: string): Promise<void> {
    if (existsSync(filepath))
      await fs.unlink(filepath)
  }
}

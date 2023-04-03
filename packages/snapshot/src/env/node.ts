import { existsSync, promises as fs } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'pathe'
import type { SnapshotEnvironment } from '../types'

export class NodeSnapshotEnvironment implements SnapshotEnvironment {
  getVersion(): string {
    return '1'
  }

  getHeader(): string {
    return `// Snapshot v${this.getVersion()}`
  }

  async resolveRawPath(testPath: string, rawPath: string) {
    return isAbsolute(rawPath)
      ? rawPath
      : resolve(dirname(testPath), rawPath)
  }

  async resolvePath(filepath: string): Promise<string> {
    return join(
      join(
        dirname(filepath), '__snapshots__'),
      `${basename(filepath)}.snap`,
    )
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

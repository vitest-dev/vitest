export interface SnapshotEnvironment {
  getVersion(): string
  getHeader(): string
  resolvePath(filepath: string): Promise<string>
  resolveRawPath(testPath: string, rawPath: string): Promise<string>
  prepareDirectory(dirPath: string): Promise<void>
  saveSnapshotFile(filepath: string, snapshot: string): Promise<void>
  readSnapshotFile(filepath: string): Promise<string | null>
  removeSnapshotFile(filepath: string): Promise<void>
}

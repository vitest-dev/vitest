export interface SnapshotEnvironment {
  resolvePath(filepath: string): Promise<string>
  prepareDirectory(filepath: string): Promise<void>
  saveSnapshotFile(filepath: string, snapshot: string): Promise<void>
  readSnapshotFile(filepath: string): Promise<string | null>
  removeSnapshotFile(filepath: string): Promise<void>
}

let _snapshotEnvironment: SnapshotEnvironment

export function setupSnapshotEnvironment(environment: SnapshotEnvironment) {
  _snapshotEnvironment = environment
}

export function getSnapshotEnironment() {
  if (!_snapshotEnvironment)
    throw new Error('Snapshot environment is not setup')
  return _snapshotEnvironment
}

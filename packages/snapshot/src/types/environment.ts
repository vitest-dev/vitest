import type { ParsedStack } from '@vitest/utils'

export interface SnapshotEnvironment {
  getVersion: () => string
  getHeader: () => string
  resolvePath: (filepath: string) => Promise<string>
  resolveRawPath: (testPath: string, rawPath: string) => Promise<string>
  saveSnapshotFile: (filepath: string, snapshot: string) => Promise<void>
  readSnapshotFile: (filepath: string) => Promise<string | null>
  removeSnapshotFile: (filepath: string) => Promise<void>
  processStackTrace?: (stack: ParsedStack) => ParsedStack
}

export interface SnapshotEnvironmentOptions {
  snapshotsDirName?: string
}

import type { ParsedStack } from '@vitest/utils'

export interface SnapshotEnvironment {
  getVersion: () => string
  getHeader: () => string
  resolvePath: (filepath: string) => Promise<string>
  resolveRawPath: (testPath: string, rawPath: string) => Promise<string>
  saveSnapshotFile: (filepath: string, snapshot: string) => Promise<void>
  readSnapshotFile: (filepath: string) => Promise<string | null>
  // Optional: return already-evaluated snapshot data. Environments that cannot
  // evaluate snapshot content in the test runtime (e.g. the browser under a
  // no-unsafe-eval CSP) implement this to evaluate elsewhere. When omitted,
  // SnapshotState falls back to `readSnapshotFile` + in-runtime evaluation.
  readSnapshotFileData?: (filepath: string) => Promise<Record<string, string> | null>
  removeSnapshotFile: (filepath: string) => Promise<void>
  processStackTrace?: (stack: ParsedStack) => ParsedStack
}

export interface SnapshotEnvironmentOptions {
  snapshotsDirName?: string
}

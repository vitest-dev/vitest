import type { OptionsReceived as PrettyFormatOptions } from 'pretty-format'

export type SnapshotData = Record<string, string>

export type SnapshotUpdateState = 'all' | 'new' | 'none'

export interface SnapshotStateOptions {
  updateSnapshot: SnapshotUpdateState
  expand?: boolean
  snapshotFormat?: PrettyFormatOptions
}

export interface SnapshotMatchOptions {
  testName: string
  received: unknown
  key?: string
  inlineSnapshot?: string
  isInline: boolean
  error?: Error
}

export interface SnapshotResult {
  filepath: string
  added: number
  fileDeleted: boolean
  matched: number
  unchecked: number
  uncheckedKeys: Array<string>
  unmatched: number
  updated: number
}

export interface UncheckedSnapshot {
  filePath: string
  keys: Array<string>
}

export interface SnapshotSummary {
  added: number
  didUpdate: boolean
  failure: boolean
  filesAdded: number
  filesRemoved: number
  filesRemovedList: Array<string>
  filesUnmatched: number
  filesUpdated: number
  matched: number
  total: number
  unchecked: number
  uncheckedKeysByFile: Array<UncheckedSnapshot>
  unmatched: number
  updated: number
}

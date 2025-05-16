import type {
  OptionsReceived as PrettyFormatOptions,
  Plugin as PrettyFormatPlugin,
} from '@vitest/pretty-format'
import type { RawSnapshotInfo } from '../port/rawSnapshot'
import type {
  SnapshotEnvironment,
  SnapshotEnvironmentOptions,
} from './environment'

export type { SnapshotEnvironment, SnapshotEnvironmentOptions }
export type SnapshotData = Record<string, string>

export type SnapshotUpdateState = 'all' | 'new' | 'none'

export type SnapshotSerializer = PrettyFormatPlugin

export interface SnapshotStateOptions {
  updateSnapshot: SnapshotUpdateState
  snapshotEnvironment: SnapshotEnvironment
  expand?: boolean
  snapshotFormat?: PrettyFormatOptions
  resolveSnapshotPath?: (path: string, extension: string, context?: any) => string
}

export interface SnapshotMatchOptions {
  testId: string
  testName: string
  received: unknown
  key?: string
  inlineSnapshot?: string
  isInline: boolean
  error?: Error
  rawSnapshot?: RawSnapshotInfo
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

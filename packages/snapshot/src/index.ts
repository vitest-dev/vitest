export { SnapshotClient } from './client'

export { default as SnapshotState } from './port/state'
export { addSerializer, getSerializers } from './port/plugins'
export { stripSnapshotIndentation } from './port/inlineSnapshot'

export type {
  SnapshotData,
  SnapshotUpdateState,
  SnapshotStateOptions,
  SnapshotMatchOptions,
  SnapshotResult,
  UncheckedSnapshot,
  SnapshotSummary,
} from './types'

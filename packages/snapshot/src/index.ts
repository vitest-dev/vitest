export { SnapshotClient } from './client'

export { stripSnapshotIndentation } from './port/inlineSnapshot'
export { addSerializer, getSerializers } from './port/plugins'
export { default as SnapshotState } from './port/state'

export type {
  SnapshotData,
  SnapshotMatchOptions,
  SnapshotResult,
  SnapshotSerializer,
  SnapshotStateOptions,
  SnapshotSummary,
  SnapshotUpdateState,
  UncheckedSnapshot,
} from './types'

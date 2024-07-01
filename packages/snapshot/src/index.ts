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
  SnapshotSerializer,
  UncheckedSnapshot,
  SnapshotSummary,
} from './types'

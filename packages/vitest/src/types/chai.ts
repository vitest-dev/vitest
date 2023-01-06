import type { MatcherState as JestMatcherState } from '@vitest/expect'
import type SnapshotState from '../integrations/snapshot/port/state'
import type { VitestEnvironment } from './config'

export interface MatcherState extends JestMatcherState {
  environment: VitestEnvironment
  snapshotState: SnapshotState
}

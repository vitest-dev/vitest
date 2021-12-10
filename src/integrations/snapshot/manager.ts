import { ResolvedConfig } from '../../types'
import {
  addSnapshotResult,
  emptySummary,
} from './utils/jest-test-result-helper'
import { SnapshotResult, SnapshotSummary } from './utils/types'

export class SnapshotManager {
  summary: SnapshotSummary = undefined!

  constructor(public config: ResolvedConfig) {
    this.clear()
  }

  clear() {
    this.summary = emptySummary(this.config.snapshotOptions)
  }

  add(result: SnapshotResult) {
    addSnapshotResult(this.summary, result)
  }
}

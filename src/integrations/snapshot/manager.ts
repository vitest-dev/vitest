import type { SnapshotResult, SnapshotSummary, ResolvedConfig } from '../../types'
import { addSnapshotResult, emptySummary } from './port/jest-test-result-helper'

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

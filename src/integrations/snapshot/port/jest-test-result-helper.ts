/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SnapshotResult, SnapshotStateOptions, SnapshotSummary } from '../../../types'
import SnapshotState from './state'

export const emptySummary = (options: SnapshotStateOptions): SnapshotSummary => {
  const summary = {
    added: 0,
    failure: false,
    filesAdded: 0,
    filesRemoved: 0,
    filesRemovedList: [],
    filesUnmatched: 0,
    filesUpdated: 0,
    matched: 0,
    total: 0,
    unchecked: 0,
    uncheckedKeysByFile: [],
    unmatched: 0,
    updated: 0,
    didUpdate: options.updateSnapshot === 'all',
  }
  return summary
}

export const packSnapshotState = (filepath: string, state: SnapshotState): SnapshotResult => {
  const snapshot: SnapshotResult = {
    filepath,
    added: 0,
    fileDeleted: false,
    matched: 0,
    unchecked: 0,
    uncheckedKeys: [],
    unmatched: 0,
    updated: 0,
  }
  const uncheckedCount = state.getUncheckedCount()
  const uncheckedKeys = state.getUncheckedKeys()
  if (uncheckedCount)
    state.removeUncheckedKeys()

  const status = state.save()
  snapshot.fileDeleted = status.deleted
  snapshot.added = state.added
  snapshot.matched = state.matched
  snapshot.unmatched = state.unmatched
  snapshot.updated = state.updated
  snapshot.unchecked = !status.deleted ? uncheckedCount : 0
  snapshot.uncheckedKeys = Array.from(uncheckedKeys)

  return snapshot
}

export const addSnapshotResult = (summary: SnapshotSummary, result: SnapshotResult): void => {
  if (result.added)
    summary.filesAdded++
  if (result.fileDeleted)
    summary.filesRemoved++
  if (result.unmatched)
    summary.filesUnmatched++
  if (result.updated)
    summary.filesUpdated++

  summary.added += result.added
  summary.matched += result.matched
  summary.unchecked += result.unchecked
  if (result.uncheckedKeys && result.uncheckedKeys.length > 0) {
    summary.uncheckedKeysByFile.push({
      filePath: result.filepath,
      keys: result.uncheckedKeys,
    })
  }

  summary.unmatched += result.unmatched
  summary.updated += result.updated
  summary.total += result.added + result.matched + result.unmatched + result.updated
}

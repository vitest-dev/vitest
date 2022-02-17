/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from 'fs'
import type { Config } from '@jest/types'
// import { getStackTraceLines, getTopFrame } from 'jest-message-util'
import type { OptionsReceived as PrettyFormatOptions } from 'pretty-format'
import type { ParsedStack, SnapshotData, SnapshotMatchOptions, SnapshotStateOptions } from '../../../types'
import { slash } from '../../../utils'
import { parseStacktrace } from '../../../utils/source-map'
import type { InlineSnapshot } from './inlineSnapshot'
import { saveInlineSnapshots } from './inlineSnapshot'

import {
  addExtraLineBreaks,
  getSnapshotData,
  keyToTestName,
  prepareExpected,
  removeExtraLineBreaks,
  saveSnapshotFile,
  serialize,
  testNameToKey,
} from './utils'

interface SnapshotReturnOptions {
  actual: string
  count: number
  expected?: string
  key: string
  pass: boolean
}

interface SaveStatus {
  deleted: boolean
  saved: boolean
}

export default class SnapshotState {
  private _counters: Map<string, number>
  private _dirty: boolean
  private _updateSnapshot: Config.SnapshotUpdateState
  private _snapshotData: SnapshotData
  private _initialData: SnapshotData
  private _snapshotPath: string
  private _inlineSnapshots: Array<InlineSnapshot>
  private _uncheckedKeys: Set<string>
  private _snapshotFormat: PrettyFormatOptions

  added: number
  expand: boolean
  matched: number
  unmatched: number
  updated: number

  constructor(snapshotPath: string, options: SnapshotStateOptions) {
    this._snapshotPath = snapshotPath
    const { data, dirty } = getSnapshotData(
      this._snapshotPath,
      options.updateSnapshot,
    )
    this._initialData = data
    this._snapshotData = data
    this._dirty = dirty
    this._inlineSnapshots = []
    this._uncheckedKeys = new Set(Object.keys(this._snapshotData))
    this._counters = new Map()
    this.expand = options.expand || false
    this.added = 0
    this.matched = 0
    this.unmatched = 0
    this._updateSnapshot = options.updateSnapshot
    this.updated = 0
    this._snapshotFormat = {
      printBasicPrototype: false,
      ...options.snapshotFormat,
    }
  }

  markSnapshotsAsCheckedForTest(testName: string): void {
    this._uncheckedKeys.forEach((uncheckedKey) => {
      if (keyToTestName(uncheckedKey) === testName)
        this._uncheckedKeys.delete(uncheckedKey)
    })
  }

  private _getInlineSnapshotStack(stacks: ParsedStack[]) {
    // if called inside resolves/rejects, stacktrace is different
    const promiseIndex = stacks.findIndex(i => i.method.match(/__VITEST_(RESOLVES|REJECTS)__/))
    if (promiseIndex !== -1)
      return stacks[promiseIndex + 3]

    // inline snapshot function is called __VITEST_INLINE_SNAPSHOT__
    // in integrations/snapshot/chai.ts
    const stackIndex = stacks.findIndex(i => i.method.includes('__VITEST_INLINE_SNAPSHOT__'))
    return stackIndex !== -1 ? stacks[stackIndex + 2] : null
  }

  private _addSnapshot(
    key: string,
    receivedSerialized: string,
    options: { isInline: boolean; error?: Error },
  ): void {
    this._dirty = true
    if (options.isInline) {
      const error = options.error || new Error('Unknown error')
      const stacks = parseStacktrace(error, true)
      stacks.forEach(i => i.file = slash(i.file))
      const stack = this._getInlineSnapshotStack(stacks)
      if (!stack) {
        throw new Error(
          `Vitest: Couldn't infer stack frame for inline snapshot.\n${JSON.stringify(stacks)}`,
        )
      }
      this._inlineSnapshots.push({
        snapshot: receivedSerialized,
        ...stack,
      })
    }
    else {
      this._snapshotData[key] = receivedSerialized
    }
  }

  clear(): void {
    this._snapshotData = this._initialData
    // this._inlineSnapshots = []
    this._counters = new Map()
    this.added = 0
    this.matched = 0
    this.unmatched = 0
    this.updated = 0
  }

  async save(): Promise<SaveStatus> {
    const hasExternalSnapshots = Object.keys(this._snapshotData).length
    const hasInlineSnapshots = this._inlineSnapshots.length
    const isEmpty = !hasExternalSnapshots && !hasInlineSnapshots

    const status: SaveStatus = {
      deleted: false,
      saved: false,
    }

    if ((this._dirty || this._uncheckedKeys.size) && !isEmpty) {
      if (hasExternalSnapshots)
        await saveSnapshotFile(this._snapshotData, this._snapshotPath)
      if (hasInlineSnapshots)
        await saveInlineSnapshots(this._inlineSnapshots)

      status.saved = true
    }
    else if (!hasExternalSnapshots && fs.existsSync(this._snapshotPath)) {
      if (this._updateSnapshot === 'all')
        fs.unlinkSync(this._snapshotPath)

      status.deleted = true
    }

    return status
  }

  getUncheckedCount(): number {
    return this._uncheckedKeys.size || 0
  }

  getUncheckedKeys(): Array<string> {
    return Array.from(this._uncheckedKeys)
  }

  removeUncheckedKeys(): void {
    if (this._updateSnapshot === 'all' && this._uncheckedKeys.size) {
      this._dirty = true
      this._uncheckedKeys.forEach(key => delete this._snapshotData[key])
      this._uncheckedKeys.clear()
    }
  }

  match({
    testName,
    received,
    key,
    inlineSnapshot,
    isInline,
    error,
  }: SnapshotMatchOptions): SnapshotReturnOptions {
    this._counters.set(testName, (this._counters.get(testName) || 0) + 1)
    const count = Number(this._counters.get(testName))

    if (!key)
      key = testNameToKey(testName, count)

    // Do not mark the snapshot as "checked" if the snapshot is inline and
    // there's an external snapshot. This way the external snapshot can be
    // removed with `--updateSnapshot`.
    if (!(isInline && this._snapshotData[key] !== undefined))
      this._uncheckedKeys.delete(key)

    const receivedSerialized = addExtraLineBreaks(serialize(received, undefined, this._snapshotFormat))
    const expected = isInline ? inlineSnapshot : this._snapshotData[key]
    const expectedTrimmed = prepareExpected(expected)
    const pass = expectedTrimmed === prepareExpected(receivedSerialized)
    const hasSnapshot = expected !== undefined
    const snapshotIsPersisted = isInline || fs.existsSync(this._snapshotPath)

    if (pass && !isInline) {
      // Executing a snapshot file as JavaScript and writing the strings back
      // when other snapshots have changed loses the proper escaping for some
      // characters. Since we check every snapshot in every test, use the newly
      // generated formatted string.
      // Note that this is only relevant when a snapshot is added and the dirty
      // flag is set.
      this._snapshotData[key] = receivedSerialized
    }

    // These are the conditions on when to write snapshots:
    //  * There's no snapshot file in a non-CI environment.
    //  * There is a snapshot file and we decided to update the snapshot.
    //  * There is a snapshot file, but it doesn't have this snapshot.
    // These are the conditions on when not to write snapshots:
    //  * The update flag is set to 'none'.
    //  * There's no snapshot file or a file without this snapshot on a CI environment.
    if (
      (hasSnapshot && this._updateSnapshot === 'all')
       || ((!hasSnapshot || !snapshotIsPersisted)
         && (this._updateSnapshot === 'new' || this._updateSnapshot === 'all'))
    ) {
      if (this._updateSnapshot === 'all') {
        if (!pass) {
          if (hasSnapshot)
            this.updated++
          else
            this.added++

          this._addSnapshot(key, receivedSerialized, { error, isInline })
        }
        else {
          this.matched++
        }
      }
      else {
        this._addSnapshot(key, receivedSerialized, { error, isInline })
        this.added++
      }

      return {
        actual: '',
        count,
        expected: '',
        key,
        pass: true,
      }
    }
    else {
      if (!pass) {
        this.unmatched++
        return {
          actual: removeExtraLineBreaks(receivedSerialized),
          count,
          expected:
          expectedTrimmed !== undefined
            ? removeExtraLineBreaks(expectedTrimmed)
            : undefined,
          key,
          pass: false,
        }
      }
      else {
        this.matched++
        return {
          actual: '',
          count,
          expected: '',
          key,
          pass: true,
        }
      }
    }
  }
}

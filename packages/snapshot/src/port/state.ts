/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { OptionsReceived as PrettyFormatOptions } from 'pretty-format'
import type { ParsedStack } from '../../../utils/src/index'
import { parseErrorStacktrace } from '../../../utils/src/source-map'
import type { SnapshotData, SnapshotEnvironment, SnapshotMatchOptions, SnapshotResult, SnapshotStateOptions, SnapshotUpdateState } from '../types'
import type { InlineSnapshot } from './inlineSnapshot'
import { saveInlineSnapshots } from './inlineSnapshot'
import type { RawSnapshot, RawSnapshotInfo } from './rawSnapshot'
import { saveRawSnapshots } from './rawSnapshot'

import {
  addExtraLineBreaks,
  getSnapshotData,
  keyToTestName,
  normalizeNewlines,
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
  private _updateSnapshot: SnapshotUpdateState
  private _snapshotData: SnapshotData
  private _initialData: SnapshotData
  private _inlineSnapshots: Array<InlineSnapshot>
  private _rawSnapshots: Array<RawSnapshot>
  private _uncheckedKeys: Set<string>
  private _snapshotFormat: PrettyFormatOptions
  private _environment: SnapshotEnvironment
  private _fileExists: boolean

  added: number
  expand: boolean
  matched: number
  unmatched: number
  updated: number

  private constructor(
    public testFilePath: string,
    public snapshotPath: string,
    snapshotContent: string | null,
    options: SnapshotStateOptions,
  ) {
    const { data, dirty } = getSnapshotData(
      snapshotContent,
      options,
    )
    this._fileExists = snapshotContent != null // TODO: update on watch?
    this._initialData = data
    this._snapshotData = data
    this._dirty = dirty
    this._inlineSnapshots = []
    this._rawSnapshots = []
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
      escapeString: false,
      ...options.snapshotFormat,
    }
    this._environment = options.snapshotEnvironment
  }

  static async create(
    testFilePath: string,
    options: SnapshotStateOptions,
  ) {
    const snapshotPath = await options.snapshotEnvironment.resolvePath(testFilePath)
    const content = await options.snapshotEnvironment.readSnapshotFile(snapshotPath)
    return new SnapshotState(testFilePath, snapshotPath, content, options)
  }

  get environment() {
    return this._environment
  }

  markSnapshotsAsCheckedForTest(testName: string): void {
    this._uncheckedKeys.forEach((uncheckedKey) => {
      if (keyToTestName(uncheckedKey) === testName)
        this._uncheckedKeys.delete(uncheckedKey)
    })
  }

  protected _inferInlineSnapshotStack(stacks: ParsedStack[]) {
    // if called inside resolves/rejects, stacktrace is different
    const promiseIndex = stacks.findIndex(i => i.method.match(/__VITEST_(RESOLVES|REJECTS)__/))
    if (promiseIndex !== -1)
      return stacks[promiseIndex + 3]

    // inline snapshot function is called __INLINE_SNAPSHOT__
    // in integrations/snapshot/chai.ts
    const stackIndex = stacks.findIndex(i => i.method.includes('__INLINE_SNAPSHOT__'))
    return stackIndex !== -1 ? stacks[stackIndex + 2] : null
  }

  private _addSnapshot(
    key: string,
    receivedSerialized: string,
    options: { isInline: boolean; rawSnapshot?: RawSnapshotInfo; error?: Error },
  ): void {
    this._dirty = true
    if (options.isInline) {
      const stacks = parseErrorStacktrace(options.error || new Error('snapshot'), { ignoreStackEntries: [] })
      const stack = this._inferInlineSnapshotStack(stacks)
      if (!stack) {
        throw new Error(
          `@vitest/snapshot: Couldn't infer stack frame for inline snapshot.\n${JSON.stringify(stacks)}`,
        )
      }
      // removing 1 column, because source map points to the wrong
      // location for js files, but `column-1` points to the same in both js/ts
      // https://github.com/vitejs/vite/issues/8657
      stack.column--
      this._inlineSnapshots.push({
        snapshot: receivedSerialized,
        ...stack,
      })
    }
    else if (options.rawSnapshot) {
      this._rawSnapshots.push({
        ...options.rawSnapshot,
        snapshot: receivedSerialized,
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
    this._dirty = false
  }

  async save(): Promise<SaveStatus> {
    const hasExternalSnapshots = Object.keys(this._snapshotData).length
    const hasInlineSnapshots = this._inlineSnapshots.length
    const hasRawSnapshots = this._rawSnapshots.length
    const isEmpty = !hasExternalSnapshots && !hasInlineSnapshots && !hasRawSnapshots

    const status: SaveStatus = {
      deleted: false,
      saved: false,
    }

    if ((this._dirty || this._uncheckedKeys.size) && !isEmpty) {
      if (hasExternalSnapshots) {
        await saveSnapshotFile(this._environment, this._snapshotData, this.snapshotPath)
        this._fileExists = true
      }
      if (hasInlineSnapshots)
        await saveInlineSnapshots(this._environment, this._inlineSnapshots)
      if (hasRawSnapshots)
        await saveRawSnapshots(this._environment, this._rawSnapshots)

      status.saved = true
    }
    else if (!hasExternalSnapshots && this._fileExists) {
      if (this._updateSnapshot === 'all') {
        await this._environment.removeSnapshotFile(this.snapshotPath)
        this._fileExists = false
      }

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
    rawSnapshot,
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

    let receivedSerialized = (rawSnapshot && typeof received === 'string')
      ? received as string
      : serialize(received, undefined, this._snapshotFormat)

    if (!rawSnapshot)
      receivedSerialized = addExtraLineBreaks(receivedSerialized)

    if (rawSnapshot) {
      // normalize EOL when snapshot contains CRLF but received is LF
      if (rawSnapshot.content && rawSnapshot.content.match(/\r\n/) && !receivedSerialized.match(/\r\n/))
        rawSnapshot.content = normalizeNewlines(rawSnapshot.content)
    }

    const expected = isInline
      ? inlineSnapshot
      : rawSnapshot
        ? rawSnapshot.content
        : this._snapshotData[key]
    const expectedTrimmed = prepareExpected(expected)
    const pass = expectedTrimmed === prepareExpected(receivedSerialized)
    const hasSnapshot = expected !== undefined
    const snapshotIsPersisted = isInline || this._fileExists || (rawSnapshot && rawSnapshot.content != null)

    if (pass && !isInline && !rawSnapshot) {
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

          this._addSnapshot(key, receivedSerialized, { error, isInline, rawSnapshot })
        }
        else {
          this.matched++
        }
      }
      else {
        this._addSnapshot(key, receivedSerialized, { error, isInline, rawSnapshot })
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

  async pack(): Promise<SnapshotResult> {
    const snapshot: SnapshotResult = {
      filepath: this.testFilePath,
      added: 0,
      fileDeleted: false,
      matched: 0,
      unchecked: 0,
      uncheckedKeys: [],
      unmatched: 0,
      updated: 0,
    }
    const uncheckedCount = this.getUncheckedCount()
    const uncheckedKeys = this.getUncheckedKeys()
    if (uncheckedCount)
      this.removeUncheckedKeys()

    const status = await this.save()
    snapshot.fileDeleted = status.deleted
    snapshot.added = this.added
    snapshot.matched = this.matched
    snapshot.unmatched = this.unmatched
    snapshot.updated = this.updated
    snapshot.unchecked = !status.deleted ? uncheckedCount : 0
    snapshot.uncheckedKeys = Array.from(uncheckedKeys)

    return snapshot
  }
}

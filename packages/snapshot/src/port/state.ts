/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { OptionsReceived as PrettyFormatOptions } from '@vitest/pretty-format'
import type { ParsedStack } from '../../../utils/src/index'
import type {
  SnapshotData,
  SnapshotEnvironment,
  SnapshotMatchOptions,
  SnapshotResult,
  SnapshotStateOptions,
  SnapshotUpdateState,
} from '../types'
import type { InlineSnapshot } from './inlineSnapshot'
import type { RawSnapshot, RawSnapshotInfo } from './rawSnapshot'
import { parseErrorStacktrace } from '../../../utils/src/source-map'
import { saveInlineSnapshots } from './inlineSnapshot'
import { saveRawSnapshots } from './rawSnapshot'

import {
  addExtraLineBreaks,
  CounterMap,
  DefaultMap,
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
  private _counters = new CounterMap<string>()
  private _dirty: boolean
  private _updateSnapshot: SnapshotUpdateState
  private _snapshotData: SnapshotData
  private _initialData: SnapshotData
  private _inlineSnapshots: Array<InlineSnapshot>
  private _inlineSnapshotStacks: Array<ParsedStack & { testId: string }>
  private _testIdToKeys = new DefaultMap<string, string[]>(() => [])
  private _rawSnapshots: Array<RawSnapshot>
  private _uncheckedKeys: Set<string>
  private _snapshotFormat: PrettyFormatOptions
  private _environment: SnapshotEnvironment
  private _fileExists: boolean
  private added = new CounterMap<string>()
  private matched = new CounterMap<string>()
  private unmatched = new CounterMap<string>()
  private updated = new CounterMap<string>()
  expand: boolean

  private constructor(
    public testFilePath: string,
    public snapshotPath: string,
    snapshotContent: string | null,
    options: SnapshotStateOptions,
  ) {
    const { data, dirty } = getSnapshotData(snapshotContent, options)
    this._fileExists = snapshotContent != null // TODO: update on watch?
    this._initialData = { ...data }
    this._snapshotData = { ...data }
    this._dirty = dirty
    this._inlineSnapshots = []
    this._inlineSnapshotStacks = []
    this._rawSnapshots = []
    this._uncheckedKeys = new Set(Object.keys(this._snapshotData))
    this.expand = options.expand || false
    this._updateSnapshot = options.updateSnapshot
    this._snapshotFormat = {
      printBasicPrototype: false,
      escapeString: false,
      ...options.snapshotFormat,
    }
    this._environment = options.snapshotEnvironment
  }

  static async create(testFilePath: string, options: SnapshotStateOptions): Promise<SnapshotState> {
    const snapshotPath = await options.snapshotEnvironment.resolvePath(
      testFilePath,
    )
    const content = await options.snapshotEnvironment.readSnapshotFile(
      snapshotPath,
    )
    return new SnapshotState(testFilePath, snapshotPath, content, options)
  }

  get environment(): SnapshotEnvironment {
    return this._environment
  }

  markSnapshotsAsCheckedForTest(testName: string): void {
    this._uncheckedKeys.forEach((uncheckedKey) => {
      // skip snapshots with following keys
      //   testName n
      //   testName > xxx n (this is for toMatchSnapshot("xxx") API)
      if (/ \d+$| > /.test(uncheckedKey.slice(testName.length))) {
        this._uncheckedKeys.delete(uncheckedKey)
      }
    })
  }

  clearTest(testId: string): void {
    // clear inline
    this._inlineSnapshots = this._inlineSnapshots.filter(s => s.testId !== testId)
    this._inlineSnapshotStacks = this._inlineSnapshotStacks.filter(s => s.testId !== testId)

    // clear file
    for (const key of this._testIdToKeys.get(testId)) {
      const name = keyToTestName(key)
      const count = this._counters.get(name)
      if (count > 0) {
        if (key in this._snapshotData || key in this._initialData) {
          this._snapshotData[key] = this._initialData[key]
        }
        this._counters.set(name, count - 1)
      }
    }
    this._testIdToKeys.delete(testId)

    // clear stats
    this.added.delete(testId)
    this.updated.delete(testId)
    this.matched.delete(testId)
    this.unmatched.delete(testId)
  }

  protected _inferInlineSnapshotStack(stacks: ParsedStack[]): ParsedStack | null {
    // if called inside resolves/rejects, stacktrace is different
    const promiseIndex = stacks.findIndex(i =>
      i.method.match(/__VITEST_(RESOLVES|REJECTS)__/),
    )
    if (promiseIndex !== -1) {
      return stacks[promiseIndex + 3]
    }

    // inline snapshot function is called __INLINE_SNAPSHOT__
    // in integrations/snapshot/chai.ts
    const stackIndex = stacks.findIndex(i =>
      i.method.includes('__INLINE_SNAPSHOT__'),
    )
    return stackIndex !== -1 ? stacks[stackIndex + 2] : null
  }

  private _addSnapshot(
    key: string,
    receivedSerialized: string,
    options: { rawSnapshot?: RawSnapshotInfo; stack?: ParsedStack; testId: string },
  ): void {
    this._dirty = true
    if (options.stack) {
      this._inlineSnapshots.push({
        snapshot: receivedSerialized,
        testId: options.testId,
        ...options.stack,
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

  async save(): Promise<SaveStatus> {
    const hasExternalSnapshots = Object.keys(this._snapshotData).length
    const hasInlineSnapshots = this._inlineSnapshots.length
    const hasRawSnapshots = this._rawSnapshots.length
    const isEmpty
      = !hasExternalSnapshots && !hasInlineSnapshots && !hasRawSnapshots

    const status: SaveStatus = {
      deleted: false,
      saved: false,
    }

    if ((this._dirty || this._uncheckedKeys.size) && !isEmpty) {
      if (hasExternalSnapshots) {
        await saveSnapshotFile(
          this._environment,
          this._snapshotData,
          this.snapshotPath,
        )
        this._fileExists = true
      }
      if (hasInlineSnapshots) {
        await saveInlineSnapshots(this._environment, this._inlineSnapshots)
      }
      if (hasRawSnapshots) {
        await saveRawSnapshots(this._environment, this._rawSnapshots)
      }

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
    testId,
    testName,
    received,
    key,
    inlineSnapshot,
    isInline,
    error,
    rawSnapshot,
  }: SnapshotMatchOptions): SnapshotReturnOptions {
    // this also increments counter for inline snapshots. maybe we shouldn't?
    this._counters.increment(testName)
    const count = this._counters.get(testName)

    if (!key) {
      key = testNameToKey(testName, count)
    }
    this._testIdToKeys.get(testId).push(key)

    // Do not mark the snapshot as "checked" if the snapshot is inline and
    // there's an external snapshot. This way the external snapshot can be
    // removed with `--updateSnapshot`.
    if (!(isInline && this._snapshotData[key] !== undefined)) {
      this._uncheckedKeys.delete(key)
    }

    let receivedSerialized
      = rawSnapshot && typeof received === 'string'
        ? (received as string)
        : serialize(received, undefined, this._snapshotFormat)

    if (!rawSnapshot) {
      receivedSerialized = addExtraLineBreaks(receivedSerialized)
    }

    if (rawSnapshot) {
      // normalize EOL when snapshot contains CRLF but received is LF
      if (
        rawSnapshot.content
        && rawSnapshot.content.match(/\r\n/)
        && !receivedSerialized.match(/\r\n/)
      ) {
        rawSnapshot.content = normalizeNewlines(rawSnapshot.content)
      }
    }

    const expected = isInline
      ? inlineSnapshot
      : rawSnapshot
        ? rawSnapshot.content
        : this._snapshotData[key]
    const expectedTrimmed = rawSnapshot ? expected : prepareExpected(expected)
    const pass = expectedTrimmed === (rawSnapshot ? receivedSerialized : prepareExpected(receivedSerialized))
    const hasSnapshot = expected !== undefined
    const snapshotIsPersisted
      = isInline
        || this._fileExists
        || (rawSnapshot && rawSnapshot.content != null)

    if (pass && !isInline && !rawSnapshot) {
      // Executing a snapshot file as JavaScript and writing the strings back
      // when other snapshots have changed loses the proper escaping for some
      // characters. Since we check every snapshot in every test, use the newly
      // generated formatted string.
      // Note that this is only relevant when a snapshot is added and the dirty
      // flag is set.
      this._snapshotData[key] = receivedSerialized
    }

    // find call site of toMatchInlineSnapshot
    let stack: ParsedStack | undefined
    if (isInline) {
      const stacks = parseErrorStacktrace(
        error || new Error('snapshot'),
        { ignoreStackEntries: [] },
      )
      const _stack = this._inferInlineSnapshotStack(stacks)
      if (!_stack) {
        throw new Error(
          `@vitest/snapshot: Couldn't infer stack frame for inline snapshot.\n${JSON.stringify(
            stacks,
          )}`,
        )
      }
      stack = this.environment.processStackTrace?.(_stack) || _stack
      // removing 1 column, because source map points to the wrong
      // location for js files, but `column-1` points to the same in both js/ts
      // https://github.com/vitejs/vite/issues/8657
      stack.column--

      // reject multiple inline snapshots at the same location
      if (this._inlineSnapshotStacks.some(s => s.file === stack!.file && s.line === stack!.line && s.column === stack!.column)) {
        // remove already succeeded snapshot
        this._inlineSnapshots = this._inlineSnapshots.filter(s => !(s.file === stack!.file && s.line === stack!.line && s.column === stack!.column))
        throw new Error('toMatchInlineSnapshot cannot be called multiple times at the same location.')
      }
      this._inlineSnapshotStacks.push({ ...stack, testId })
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
          if (hasSnapshot) {
            this.updated.increment(testId)
          }
          else {
            this.added.increment(testId)
          }

          this._addSnapshot(key, receivedSerialized, {
            stack,
            testId,
            rawSnapshot,
          })
        }
        else {
          this.matched.increment(testId)
        }
      }
      else {
        this._addSnapshot(key, receivedSerialized, {
          stack,
          testId,
          rawSnapshot,
        })
        this.added.increment(testId)
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
        this.unmatched.increment(testId)
        return {
          actual: rawSnapshot ? receivedSerialized : removeExtraLineBreaks(receivedSerialized),
          count,
          expected:
            expectedTrimmed !== undefined
              ? rawSnapshot ? expectedTrimmed : removeExtraLineBreaks(expectedTrimmed)
              : undefined,
          key,
          pass: false,
        }
      }
      else {
        this.matched.increment(testId)
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
    if (uncheckedCount) {
      this.removeUncheckedKeys()
    }

    const status = await this.save()
    snapshot.fileDeleted = status.deleted
    snapshot.added = this.added.total()
    snapshot.matched = this.matched.total()
    snapshot.unmatched = this.unmatched.total()
    snapshot.updated = this.updated.total()
    snapshot.unchecked = !status.deleted ? uncheckedCount : 0
    snapshot.uncheckedKeys = Array.from(uncheckedKeys)

    return snapshot
  }
}

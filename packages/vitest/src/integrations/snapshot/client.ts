import path from 'pathe'
import { expect } from 'chai'
import type { SnapshotResult, Test } from '../../types'
import { rpc } from '../../runtime/rpc'
import { getNames } from '../../utils'
import { equals, iterableEquality, subsetEquality } from '../chai/jest-utils'
import { deepMergeSnapshot } from './port/utils'
import SnapshotState from './port/state'

export interface Context {
  file: string
  title?: string
  fullTitle?: string
}

const resolveSnapshotPath = (testPath: string) =>
  path.join(
    path.join(path.dirname(testPath), '__snapshots__'),
    `${path.basename(testPath)}.snap`,
  )

export class SnapshotClient {
  test: Test | undefined
  testFile = ''
  snapshotState: SnapshotState | undefined

  setTest(test: Test) {
    this.test = test

    if (this.testFile !== this.test.file!.filepath) {
      if (this.snapshotState)
        this.saveSnap()

      this.testFile = this.test!.file!.filepath
      this.snapshotState = new SnapshotState(
        resolveSnapshotPath(this.testFile),
        __vitest_worker__!.config.snapshotOptions,
      )
    }
  }

  clearTest() {
    this.test = undefined
  }

  assert(received: unknown, message?: string, isInline = false, properties?: object, inlineSnapshot?: string, error?: Error): void {
    if (!this.test)
      throw new Error('Snapshot cannot be used outside of test')

    if (typeof properties === 'object') {
      if (typeof received !== 'object' || !received)
        throw new Error('Received value must be an object when the matcher has properties')

      try {
        const pass = equals(received, properties, [iterableEquality, subsetEquality])
        if (!pass)
          expect(received).equals(properties)
        else
          received = deepMergeSnapshot(received, properties)
      }
      catch (err: any) {
        err.message = 'Snapshot mismatched'
        throw err
      }
    }

    const testName = [
      ...getNames(this.test).slice(1),
      ...(message ? [message] : []),
    ].join(' > ')

    const { actual, expected, key, pass } = this.snapshotState!.match({
      testName,
      received,
      isInline,
      error,
      inlineSnapshot,
    })

    if (!pass) {
      try {
        expect(actual.trim()).equals(expected ? expected.trim() : '')
      }
      catch (error: any) {
        error.message = `Snapshot \`${key || 'unknown'}\` mismatched`
        throw error
      }
    }
  }

  async saveSnap() {
    if (!this.testFile || !this.snapshotState) return
    const result = await packSnapshotState(this.testFile, this.snapshotState)
    await rpc().snapshotSaved(result)

    this.testFile = ''
    this.snapshotState = undefined
  }
}

export async function packSnapshotState(filepath: string, state: SnapshotState): Promise<SnapshotResult> {
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

  const status = await state.save()
  snapshot.fileDeleted = status.deleted
  snapshot.added = state.added
  snapshot.matched = state.matched
  snapshot.unmatched = state.unmatched
  snapshot.updated = state.updated
  snapshot.unchecked = !status.deleted ? uncheckedCount : 0
  snapshot.uncheckedKeys = Array.from(uncheckedKeys)

  return snapshot
}

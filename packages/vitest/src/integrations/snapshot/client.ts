import path from 'pathe'
import { expect } from 'chai'
import type { SnapshotResult, Test } from '../../types'
import { rpc } from '../../runtime/rpc'
import { getNames } from '../../utils'
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

// TODO: remove extra snapshot state
// const resolveTestPath = (snapshotPath: string) =>
//   path.resolve(
//     path.dirname(snapshotPath),
//     '..',
//     path.basename(snapshotPath, '.snap'),
//   )

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
        process.__vitest_worker__!.config.snapshotOptions,
      )
    }
  }

  clearTest() {
    this.test = undefined
  }

  assert(received: unknown, message?: string, inlineSnapshot?: string): void {
    if (!this.test)
      throw new Error('Snapshot cannot be used outside of test')

    const testName = [
      ...getNames(this.test).slice(1),
      ...(message ? [message] : []),
    ].join(' > ')
    const { actual, expected, key, pass } = this.snapshotState!.match({
      testName,
      received,
      isInline: !!inlineSnapshot,
      inlineSnapshot: inlineSnapshot?.trim(),
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
    const result = packSnapshotState(this.testFile, this.snapshotState)
    await rpc('snapshotSaved', result)

    this.testFile = ''
    this.snapshotState = undefined
  }
}

export function packSnapshotState(filepath: string, state: SnapshotState): SnapshotResult {
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

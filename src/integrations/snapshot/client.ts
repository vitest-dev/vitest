import path from 'path'
import Snap, { SnapshotStateType } from 'jest-snapshot'
import { expect } from 'chai'
import { Test } from '../../types'
import { rpc } from '../../runtime/rpc'
import { packSnapshotState } from './utils/jest-test-result-helper'

const { SnapshotState } = Snap

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
  ctx: Context | undefined
  testFile = ''
  snapshotState: SnapshotStateType | undefined

  setTest(test: Test) {
    this.ctx = {
      file: test.file?.filepath || test.name,
      title: test.name,
      fullTitle: [test.suite.name, test.name].filter(Boolean).join(' > '),
    }

    if (this.testFile !== this.ctx.file) {
      if (this.snapshotState)
        this.saveSnap()

      this.snapshotState = new SnapshotState(
        resolveSnapshotPath(this.ctx.file),
        process.__vitest_worker__!.config.snapshotOptions,
      )
      this.testFile = this.ctx.file
    }
  }

  clearTest() {
    this.ctx = undefined
  }

  assert(received: unknown, message: string): void {
    if (!this.ctx)
      throw new Error('Snapshot can\'t not be used outside of test')

    const { actual, expected, key, pass } = this.snapshotState!.match({
      testName: this.ctx.fullTitle || this.ctx.title || this.ctx.file,
      received,
      isInline: false,
    })

    if (!pass) {
      // improve log
      expect(actual.trim()).equals(
        expected ? expected.trim() : '',
        message || `Snapshot name: \`${key}\``,
      )
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

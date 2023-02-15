import { expect } from 'chai'
import { equals, iterableEquality, subsetEquality } from '@vitest/expect'
import type { Suite, Test } from '@vitest/runner'
import { getNames } from '@vitest/runner/utils'
import { rpc } from '../../runtime/rpc'
import { getWorkerState } from '../../utils'
import { deepMergeSnapshot } from './port/utils'
import SnapshotState from './port/state'

export interface Context {
  file: string
  title?: string
  fullTitle?: string
}

interface AssertOptions {
  received: unknown
  test?: Test
  message?: string
  isInline?: boolean
  properties?: object
  inlineSnapshot?: string
  error?: Error
  errorMessage?: string
}

export class SnapshotClient {
  test: Test | undefined
  suite: Suite | undefined
  snapshotState: SnapshotState | undefined
  snapshotStateMap = new Map<string, SnapshotState>()

  async setTaskBase(test: Test, suite?: Suite) {
    suite ? this.suite = suite : this.test = test

    if (this.snapshotState?.testFilePath !== (this.test?.file!.filepath || this.suite?.filepath || this.suite?.file?.filepath)) {
      this.saveCurrent()

      const filePath = this.test?.file?.filepath || this.suite?.filepath
      if (!this.getSnapshotState(this.test ? this.test : undefined, this.suite ? this.suite : undefined)) {
        this.snapshotStateMap.set(
          filePath!,
          await SnapshotState.create(
            filePath!,
            getWorkerState().config.snapshotOptions,
          ),
        )
      }
      this.snapshotState = this.getSnapshotState(this.test ? this.test : undefined, this.suite ? this.suite : undefined)
    }
  }

  getSnapshotState(test?: Test, suite?: Suite) {
    return this.snapshotStateMap.get((test?.file?.filepath || suite?.filepath)!)!
  }

  clearTest() {
    this.test = undefined
  }

  skipTestSnapshots(test: Test) {
    this.snapshotState?.markSnapshotsAsCheckedForTest(test.name)
  }

  skipSuiteSnapshots(suite: Suite) {
    if (suite.mode === 'skip')
      this.snapshotState?.markSnapshotsAsSkippedForTest(suite.name)
  }

  assert(options: AssertOptions): void {
    const {
      test = this.test,
      message,
      isInline = false,
      properties,
      inlineSnapshot,
      error,
      errorMessage,
    } = options
    let { received } = options

    if (!test)
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
        err.message = errorMessage || 'Snapshot mismatched'
        throw err
      }
    }

    const testName = [
      ...getNames(test).slice(1),
      ...(message ? [message] : []),
    ].join(' > ')

    const snapshotState = this.getSnapshotState(test)

    const skippedSnapshot = test.suite.tasks.find(t => t.mode === 'skip')

    if (skippedSnapshot)
      snapshotState.markSnapshotsAsSkippedForTest(skippedSnapshot.name)

    const { actual, expected, key, pass } = snapshotState.match({
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
        error.message = errorMessage || `Snapshot \`${key || 'unknown'}\` mismatched`
        throw error
      }
    }
  }

  async saveCurrent() {
    if (!this.snapshotState)
      return
    const result = await this.snapshotState.pack()
    await rpc().snapshotSaved(result)

    this.snapshotState = undefined
  }

  clear() {
    this.snapshotStateMap.clear()
  }
}

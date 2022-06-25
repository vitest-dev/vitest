import { expect } from 'chai'
import type { Test } from '../../types'
import { rpc } from '../../runtime/rpc'
import { getNames, getWorkerState } from '../../utils'
import { equals, iterableEquality, subsetEquality } from '../chai/jest-utils'
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
  snapshotState: SnapshotState | undefined
  snapshotStateMap = new Map<string, SnapshotState>()

  async setTest(test: Test) {
    this.test = test

    if (this.snapshotState?.testFilePath !== this.test.file!.filepath) {
      this.saveCurrent()

      const filePath = this.test!.file!.filepath
      if (!this.getSnapshotState(test)) {
        this.snapshotStateMap.set(
          filePath,
          new SnapshotState(
            filePath,
            await rpc().resolveSnapshotPath(filePath),
            getWorkerState().config.snapshotOptions,
          ),
        )
      }
      this.snapshotState = this.getSnapshotState(test)
    }
  }

  getSnapshotState(test: Test) {
    return this.snapshotStateMap.get(test.file!.filepath)!
  }

  clearTest() {
    this.test = undefined
  }

  skipTestSnapshots(test: Test) {
    this.snapshotState?.markSnapshotsAsCheckedForTest(test.name)
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

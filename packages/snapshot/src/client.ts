import { deepMergeSnapshot } from './port/utils'
import SnapshotState from './port/state'
import type { SnapshotStateOptions } from './types'

const createMismatchError = (message: string, actual: unknown, expected: unknown) => {
  const error = new Error(message)
  Object.defineProperty(error, 'actual', {
    value: actual,
    enumerable: true,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(error, 'expected', {
    value: expected,
    enumerable: true,
    configurable: true,
    writable: true,
  })
  return error
}

export interface Context {
  file: string
  title?: string
  fullTitle?: string
}

interface AssertOptions {
  received: unknown
  filepath?: string
  name?: string
  message?: string
  isInline?: boolean
  properties?: object
  inlineSnapshot?: string
  error?: Error
  errorMessage?: string
}

export class SnapshotClient {
  filepath?: string
  name?: string
  snapshotState: SnapshotState | undefined
  snapshotStateMap = new Map<string, SnapshotState>()

  constructor(private Service = SnapshotState) {}

  async setTest(filepath: string, name: string, options: SnapshotStateOptions) {
    this.filepath = filepath
    this.name = name

    if (this.snapshotState?.testFilePath !== filepath) {
      this.resetCurrent()

      if (!this.getSnapshotState(filepath)) {
        this.snapshotStateMap.set(
          filepath,
          await this.Service.create(
            filepath,
            options,
          ),
        )
      }
      this.snapshotState = this.getSnapshotState(filepath)
    }
  }

  getSnapshotState(filepath: string) {
    return this.snapshotStateMap.get(filepath)!
  }

  clearTest() {
    this.filepath = undefined
    this.name = undefined
  }

  skipTestSnapshots(name: string) {
    this.snapshotState?.markSnapshotsAsCheckedForTest(name)
  }

  /**
   * Should be overriden by the consumer.
   *
   * Vitest checks equality with @vitest/expect.
   */
  equalityCheck(received: unknown, expected: unknown) {
    return received === expected
  }

  assert(options: AssertOptions): void {
    const {
      filepath = this.filepath,
      name = this.name,
      message,
      isInline = false,
      properties,
      inlineSnapshot,
      error,
      errorMessage,
    } = options
    let { received } = options

    if (!filepath)
      throw new Error('Snapshot cannot be used outside of test')

    if (typeof properties === 'object') {
      if (typeof received !== 'object' || !received)
        throw new Error('Received value must be an object when the matcher has properties')

      try {
        const pass = this.equalityCheck(received, properties)
        // const pass = equals(received, properties, [iterableEquality, subsetEquality])
        if (!pass)
          throw createMismatchError('Snapshot properties mismatched', received, properties)
        else
          received = deepMergeSnapshot(received, properties)
      }
      catch (err: any) {
        err.message = errorMessage || 'Snapshot mismatched'
        throw err
      }
    }

    const testName = [
      name,
      ...(message ? [message] : []),
    ].join(' > ')

    const snapshotState = this.getSnapshotState(filepath)

    const { actual, expected, key, pass } = snapshotState.match({
      testName,
      received,
      isInline,
      error,
      inlineSnapshot,
    })

    if (!pass)
      throw createMismatchError(`Snapshot \`${key || 'unknown'}\` mismatched`, actual?.trim(), expected?.trim())
  }

  async resetCurrent() {
    if (!this.snapshotState)
      return null
    const result = await this.snapshotState.pack()

    this.snapshotState = undefined
    return result
  }

  clear() {
    this.snapshotStateMap.clear()
  }
}

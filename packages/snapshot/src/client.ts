import { deepMergeSnapshot } from './port/utils'
import SnapshotState from './port/state'
import type { SnapshotStateOptions } from './types'
import type { RawSnapshotInfo } from './port/rawSnapshot'

function createMismatchError(message: string, expand: boolean | undefined, actual: unknown, expected: unknown) {
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
  Object.defineProperty(error, 'diffOptions', { value: { expand } })
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
  rawSnapshot?: RawSnapshotInfo
}

export interface SnapshotClientOptions {
  isEqual?: (received: unknown, expected: unknown) => boolean
}

export class SnapshotClient {
  filepath?: string
  name?: string
  snapshotState: SnapshotState | undefined
  snapshotStateMap = new Map<string, SnapshotState>()

  constructor(private options: SnapshotClientOptions = {}) {}

  async startCurrentRun(filepath: string, name: string, options: SnapshotStateOptions) {
    this.filepath = filepath
    this.name = name

    if (this.snapshotState?.testFilePath !== filepath) {
      await this.finishCurrentRun()

      if (!this.getSnapshotState(filepath)) {
        this.snapshotStateMap.set(
          filepath,
          await SnapshotState.create(
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
      rawSnapshot,
    } = options
    let { received } = options

    if (!filepath)
      throw new Error('Snapshot cannot be used outside of test')

    if (typeof properties === 'object') {
      if (typeof received !== 'object' || !received)
        throw new Error('Received value must be an object when the matcher has properties')

      try {
        const pass = this.options.isEqual?.(received, properties) ?? false
        // const pass = equals(received, properties, [iterableEquality, subsetEquality])
        if (!pass)
          throw createMismatchError('Snapshot properties mismatched', this.snapshotState?.expand, received, properties)
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
      rawSnapshot,
    })

    if (!pass)
      throw createMismatchError(`Snapshot \`${key || 'unknown'}\` mismatched`, this.snapshotState?.expand, actual?.trim(), expected?.trim())
  }

  async assertRaw(options: AssertOptions): Promise<void> {
    if (!options.rawSnapshot)
      throw new Error('Raw snapshot is required')

    const {
      filepath = this.filepath,
      rawSnapshot,
    } = options

    if (rawSnapshot.content == null) {
      if (!filepath)
        throw new Error('Snapshot cannot be used outside of test')

      const snapshotState = this.getSnapshotState(filepath)

      // save the filepath, so it don't lose even if the await make it out-of-context
      options.filepath ||= filepath
      // resolve and read the raw snapshot file
      rawSnapshot.file = await snapshotState.environment.resolveRawPath(filepath, rawSnapshot.file)
      rawSnapshot.content = await snapshotState.environment.readSnapshotFile(rawSnapshot.file) || undefined
    }

    return this.assert(options)
  }

  async finishCurrentRun() {
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

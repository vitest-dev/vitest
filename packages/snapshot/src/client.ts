import type { DomainMatchResult, DomainSnapshotAdapter } from './domain'
import type { RawSnapshotInfo } from './port/rawSnapshot'
import type { SnapshotResult, SnapshotStateOptions } from './types'
import SnapshotState from './port/state'
import { deepMergeSnapshot } from './port/utils'

function createMismatchError(
  message: string,
  expand: boolean | undefined,
  actual: unknown,
  expected: unknown,
) {
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
  filepath: string
  name: string
  /**
   * Not required but needed for `SnapshotClient.clearTest` to implement test-retry behavior.
   * @default name
   */
  testId?: string
  message?: string
  isInline?: boolean
  properties?: object
  inlineSnapshot?: string
  error?: Error
  errorMessage?: string
  rawSnapshot?: RawSnapshotInfo
}

interface AssertDomainOptions<Options = unknown> extends Omit<AssertOptions, 'received'> {
  received: unknown
  adapter: DomainSnapshotAdapter<any, any, Options>
  adapterOptions?: Options
}

export interface SnapshotClientOptions {
  isEqual?: (received: unknown, expected: unknown) => boolean
}

export class SnapshotClient {
  snapshotStateMap: Map<string, SnapshotState> = new Map()

  constructor(private options: SnapshotClientOptions = {}) {}

  async setup(
    filepath: string,
    options: SnapshotStateOptions,
  ): Promise<void> {
    if (this.snapshotStateMap.has(filepath)) {
      return
    }
    this.snapshotStateMap.set(
      filepath,
      await SnapshotState.create(filepath, options),
    )
  }

  async finish(filepath: string): Promise<SnapshotResult> {
    const state = this.getSnapshotState(filepath)
    const result = await state.pack()
    this.snapshotStateMap.delete(filepath)
    return result
  }

  skipTest(filepath: string, testName: string): void {
    const state = this.getSnapshotState(filepath)
    state.markSnapshotsAsCheckedForTest(testName)
  }

  clearTest(filepath: string, testId: string): void {
    const state = this.getSnapshotState(filepath)
    state.clearTest(testId)
  }

  getSnapshotState(filepath: string): SnapshotState {
    const state = this.snapshotStateMap.get(filepath)
    if (!state) {
      throw new Error(
        `The snapshot state for '${filepath}' is not found. Did you call 'SnapshotClient.setup()'?`,
      )
    }
    return state
  }

  assert(options: AssertOptions): void {
    const {
      filepath,
      name,
      testId = name,
      message,
      isInline = false,
      properties,
      inlineSnapshot,
      error,
      errorMessage,
      rawSnapshot,
    } = options
    let { received } = options

    if (!filepath) {
      throw new Error('Snapshot cannot be used outside of test')
    }

    const snapshotState = this.getSnapshotState(filepath)

    if (typeof properties === 'object') {
      if (typeof received !== 'object' || !received) {
        throw new Error(
          'Received value must be an object when the matcher has properties',
        )
      }

      try {
        const pass = this.options.isEqual?.(received, properties) ?? false
        // const pass = equals(received, properties, [iterableEquality, subsetEquality])
        if (!pass) {
          throw createMismatchError(
            'Snapshot properties mismatched',
            snapshotState.expand,
            received,
            properties,
          )
        }
        else {
          received = deepMergeSnapshot(received, properties)
        }
      }
      catch (err: any) {
        err.message = errorMessage || 'Snapshot mismatched'
        throw err
      }
    }

    const testName = [name, ...(message ? [message] : [])].join(' > ')

    const { actual, expected, key, pass } = snapshotState.match({
      testId,
      testName,
      received,
      isInline,
      error,
      inlineSnapshot,
      rawSnapshot,
    })

    if (!pass) {
      throw createMismatchError(
        `Snapshot \`${key || 'unknown'}\` mismatched`,
        snapshotState.expand,
        rawSnapshot ? actual : actual?.trim(),
        rawSnapshot ? expected : expected?.trim(),
      )
    }
  }

  assertDomain<Options = unknown>(options: AssertDomainOptions<Options>): void {
    const {
      received,
      filepath,
      name,
      testId = name,
      inlineSnapshot,
      adapter,
      adapterOptions,
    } = options

    const context = {
      filepath,
      name,
      testId,
    }

    const captured = adapter.capture(received, context, adapterOptions)
    const rendered = adapter.render(captured, context, 'assert', adapterOptions)

    let snapshotInput = rendered
    let normalizedInlineSnapshot = inlineSnapshot
    let domainMatchResult: DomainMatchResult | undefined
    if (inlineSnapshot && adapter.match) {
      const expected = adapter.parseExpected
        ? adapter.parseExpected(inlineSnapshot, context, adapterOptions)
        : inlineSnapshot
      domainMatchResult = adapter.match(captured, expected, context, adapterOptions)
      if (domainMatchResult.expected !== undefined) {
        normalizedInlineSnapshot = domainMatchResult.expected
      }
      if (domainMatchResult.pass) {
        snapshotInput = normalizedInlineSnapshot ?? inlineSnapshot
      }
      else if (domainMatchResult.actual !== undefined) {
        snapshotInput = domainMatchResult.actual
      }
    }

    try {
      this.assert({
        ...options,
        inlineSnapshot: normalizedInlineSnapshot,
        received: snapshotInput,
      })
    }
    catch (error) {
      if (domainMatchResult) {
        const failure = error as Error & { domainMatchResult?: DomainMatchResult }
        if (!domainMatchResult.pass && domainMatchResult.message) {
          failure.message = `${failure.message}\n${domainMatchResult.message}`
        }
        Object.defineProperty(failure, 'domainMatchResult', {
          value: domainMatchResult,
          enumerable: true,
          configurable: true,
          writable: true,
        })
      }
      throw error
    }
  }

  async assertRaw(options: AssertOptions): Promise<void> {
    if (!options.rawSnapshot) {
      throw new Error('Raw snapshot is required')
    }

    const { filepath, rawSnapshot } = options

    if (rawSnapshot.content == null) {
      if (!filepath) {
        throw new Error('Snapshot cannot be used outside of test')
      }

      const snapshotState = this.getSnapshotState(filepath)

      // save the filepath, so it don't lose even if the await make it out-of-context
      options.filepath ||= filepath
      // resolve and read the raw snapshot file
      rawSnapshot.file = await snapshotState.environment.resolveRawPath(
        filepath,
        rawSnapshot.file,
      )
      rawSnapshot.content
        = (await snapshotState.environment.readSnapshotFile(rawSnapshot.file))
          ?? undefined
    }

    return this.assert(options)
  }

  clear(): void {
    this.snapshotStateMap.clear()
  }
}

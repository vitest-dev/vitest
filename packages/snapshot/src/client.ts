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

interface AssertDomainPollOptions<Options = unknown> extends Omit<AssertDomainOptions<Options>, 'received'> {
  poll: () => Promise<unknown> | unknown
  timeout?: number
  interval?: number
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

  /** @experimental */
  assertDomain<Options = unknown>(options: AssertDomainOptions<Options>): void {
    const {
      received,
      filepath,
      name,
      testId = name,
      message,
      adapter,
      adapterOptions,
      isInline = false,
      inlineSnapshot,
      error,
    } = options

    if (!filepath) {
      throw new Error('Snapshot cannot be used outside of test')
    }

    const context = {
      filepath,
      name,
      testId,
    }

    const captured = adapter.capture(received, context, adapterOptions)
    const rendered = adapter.render(captured, context, adapterOptions)

    const snapshotState = this.getSnapshotState(filepath)
    const testName = [name, ...(message ? [message] : [])].join(' > ')

    const { actual, expected, key, pass } = snapshotState.matchDomain({
      testId,
      testName,
      received: rendered,
      isInline,
      inlineSnapshot,
      error,
      isEqual: (existingSnapshot) => {
        const parsed = adapter.parseExpected(existingSnapshot, context, adapterOptions)
        return adapter.match(captured, parsed, context, adapterOptions)
      },
    })

    if (!pass) {
      throw createMismatchError(
        `Snapshot \`${key || 'unknown'}\` mismatched`,
        snapshotState.expand,
        actual?.trim(),
        expected?.trim(),
      )
    }
  }

  /**
   * @experimental
   */
  // TODO: consolidate with expect.poll logic
  async assertDomainWithRetry<Options = unknown>(options: AssertDomainPollOptions<Options>): Promise<void> {
    const {
      poll,
      filepath,
      name,
      testId = name,
      message,
      adapter,
      adapterOptions,
      isInline = false,
      inlineSnapshot,
      error,
      timeout = 1000,
      interval = 50,
    } = options

    if (!filepath) {
      throw new Error('Snapshot cannot be used outside of test')
    }

    const snapshotState = this.getSnapshotState(filepath)
    const testName = [name, ...(message ? [message] : [])].join(' > ')
    const context = { filepath, name, testId }

    // Probe: read existing snapshot without mutating state
    const { expected: existingSnapshot, updateSnapshot, consume } = snapshotState.probe(testName, testId, {
      isInline,
      inlineSnapshot,
    })

    const hasSnapshot = existingSnapshot != null && existingSnapshot.length > 0
    const shouldRetryMatch = hasSnapshot && updateSnapshot !== 'all'

    let lastCaptured: any
    let lastRendered: string | undefined
    let lastResult: DomainMatchResult | undefined
    let lastPollError: unknown

    const TIMEOUT = Symbol('timeout')
    const deadline = Date.now() + timeout

    function raceTimeout<T>(promise: Promise<T>): Promise<T | typeof TIMEOUT> {
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        return Promise.resolve(TIMEOUT)
      }
      return Promise.race([
        promise,
        new Promise<typeof TIMEOUT>(r => setTimeout(() => r(TIMEOUT), remaining)),
      ])
    }

    if (shouldRetryMatch) {
      // Parse expected once — it doesn't change between retries
      const parsedExpected = adapter.parseExpected(existingSnapshot!, context, adapterOptions)

      // Retry loop: capture + match, no state mutation
      while (true) {
        try {
          const received = await raceTimeout(Promise.resolve(poll()))
          if (received === TIMEOUT) {
            break
          }
          lastCaptured = adapter.capture(received, context, adapterOptions)
          lastRendered = adapter.render(lastCaptured, context, adapterOptions)
          lastResult = adapter.match(lastCaptured, parsedExpected, context, adapterOptions)
          if (lastResult.pass) {
            break
          }
        }
        catch (e) {
          // poll() threw — value not ready, keep retrying
          lastPollError = e
        }

        if (Date.now() >= deadline) {
          break
        }
        await new Promise(r => setTimeout(r, interval))
      }
    }
    else {
      // No match retry, but still retry poll() until it succeeds.
      // The value may not be available yet (e.g. element doesn't exist).
      while (true) {
        try {
          const received = await raceTimeout(Promise.resolve(poll()))
          if (received === TIMEOUT) {
            throw new Error('poll() timed out')
          }
          lastCaptured = adapter.capture(received, context, adapterOptions)
          lastRendered = adapter.render(lastCaptured, context, adapterOptions)
          break
        }
        catch (e) {
          if (Date.now() >= deadline) {
            throw e
          }
          await new Promise(r => setTimeout(r, interval))
        }
      }
    }

    // poll() never succeeded — consume the probed key to prevent
    // the snapshot from being deleted as obsolete, then throw.
    if (lastRendered == null) {
      consume()
      throw lastPollError || new Error('poll() never returned a value within the timeout')
    }

    // Commit: single matchDomain call
    const { actual, expected, key, pass } = snapshotState.matchDomain({
      testId,
      testName,
      received: lastRendered!,
      isInline,
      inlineSnapshot,
      error,
      isEqual: (snapshot) => {
        // If we already have a result from the probe loop, return it
        if (lastResult) {
          return lastResult
        }
        // Otherwise (no-retry path), compare now
        const parsed = adapter.parseExpected(snapshot, context, adapterOptions)
        return adapter.match(lastCaptured, parsed, context, adapterOptions)
      },
    })

    if (!pass) {
      throw createMismatchError(
        `Snapshot \`${key || 'unknown'}\` mismatched`,
        snapshotState.expand,
        actual?.trim(),
        expected?.trim(),
      )
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

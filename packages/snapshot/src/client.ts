import type { DomainMatchResult, DomainSnapshotAdapter } from './domain'
import type { RawSnapshotInfo } from './port/rawSnapshot'
import type { SnapshotResult, SnapshotStateOptions } from './types'
import SnapshotState from './port/state'
import { deepMergeSnapshot } from './port/utils'

const now = globalThis.performance
  ? globalThis.performance.now.bind(globalThis.performance)
  : Date.now

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

interface AssertDomainOptions extends Omit<AssertOptions, 'received'> {
  received: unknown
  adapter: DomainSnapshotAdapter<any, any>
}

interface AssertDomainPollOptions extends Omit<AssertDomainOptions, 'received'> {
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

  assertDomain(options: AssertDomainOptions): void {
    const {
      received,
      filepath,
      name,
      testId = name,
      message,
      adapter,
      isInline = false,
      inlineSnapshot,
      error,
    } = options

    if (!filepath) {
      throw new Error('Snapshot cannot be used outside of test')
    }

    const captured = adapter.capture(received)
    const rendered = adapter.render(captured)

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
        const parsed = adapter.parseExpected(existingSnapshot)
        return adapter.match(captured, parsed)
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

  // TODO: consolidate with expect.poll logic
  async pollAssertDomain(options: AssertDomainPollOptions): Promise<void> {
    const {
      poll,
      filepath,
      name,
      testId = name,
      message,
      adapter,
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

    // Probe: read existing snapshot without mutating state
    const expectedSnapshot = snapshotState.probeExpectedSnapshot({
      testName,
      testId,
      isInline,
      inlineSnapshot,
    })

    // TODO: refactor slop
    let lastCaptured: unknown
    let lastRendered: string | undefined
    let lastResult: DomainMatchResult | undefined
    let lastPollError: unknown // TODO: rename?

    const TIMEOUT = Symbol('timeout')
    const startTime = now()

    function raceTimeout<T>(promise: Promise<T>): Promise<T | typeof TIMEOUT> {
      const remaining = timeout - (now() - startTime)
      if (remaining <= 0) {
        return Promise.resolve(TIMEOUT)
      }
      return Promise.race([
        promise,
        new Promise<typeof TIMEOUT>(r => setTimeout(() => r(TIMEOUT), remaining)),
      ])
    }

    async function delayWithTimeout(): Promise<typeof TIMEOUT | void> {
      return raceTimeout(new Promise<void>(r => setTimeout(r, interval)))
    }

    // TODO: stability should be always required
    // otherwise existing unstable snapshots can pass without `--update` and fails with `--update`
    if (expectedSnapshot.data && snapshotState.snapshotUpdateState !== 'all') {
      // Parse expected once — it doesn't change between retries
      const parsedExpected = adapter.parseExpected(expectedSnapshot.data)

      // Retry loop: capture + match, no state mutation
      while (true) {
        try {
          const received = await raceTimeout(Promise.resolve(poll()))
          if (received === TIMEOUT) {
            break
          }
          lastCaptured = adapter.capture(received)
          lastRendered = adapter.render(lastCaptured)
          lastResult = adapter.match(lastCaptured, parsedExpected)
          if (lastResult.pass) {
            break
          }
        }
        catch (e) {
          // poll() threw — value not ready, keep retrying
          lastPollError = e
        }

        if (await delayWithTimeout() === TIMEOUT) {
          break
        }
      }
    }
    else {
      // No existing snapshot or update mode.
      // Poll until the rendered value stabilizes (two consecutive
      // iterations produce the same output) so that a flaky result
      // won't be captured as an initial snapshot nor an new snapshot
      // with --update
      while (true) {
        try {
          const received = await raceTimeout(Promise.resolve(poll()))
          if (received === TIMEOUT) {
            lastPollError ??= new Error('poll() timed out')
            break
          }
          const captured = adapter.capture(received)
          const rendered = adapter.render(captured)
          const isStable = rendered === lastRendered
          lastCaptured = captured
          lastRendered = rendered
          if (isStable) {
            lastPollError = undefined
            break
          }
          lastPollError ??= new Error('poll() did not produce a stable snapshot')
        }
        catch (e) {
          // poll() threw — value not ready, reset stability and retry.
          lastRendered = undefined
          lastCaptured = undefined
          lastPollError = e
        }
        // retry after delay
        if (await delayWithTimeout() === TIMEOUT) {
          lastPollError ??= new Error('poll() timed out')
          break
        }
      }
    }

    // poll() never succeeded or new snapshot is unstable
    if (lastPollError || lastRendered == null) {
      // consume the probed key to prevent
      // the snapshot from being deleted as obsolete
      expectedSnapshot.markAsChecked()
      throw lastPollError || new Error('poll() never returned a value within the timeout')
    }

    // Commit: single matchDomain call
    const matchResult = snapshotState.matchDomain({
      testId,
      testName,
      received: lastRendered,
      isInline,
      inlineSnapshot,
      error,
      isEqual: (snapshot) => {
        // If we already have a result from the probe loop, return it
        if (lastResult) {
          return lastResult
        }
        // Otherwise (no-retry path), compare now
        const parsed = adapter.parseExpected(snapshot)
        return adapter.match(lastCaptured, parsed)
      },
    })

    if (!matchResult.pass) {
      throw createMismatchError(
        `Snapshot \`${matchResult.key || 'unknown'}\` mismatched`,
        snapshotState.expand,
        matchResult.actual?.trim(),
        matchResult.expected?.trim(),
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

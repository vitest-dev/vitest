import type { DomainSnapshotAdapter } from './domain'
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

    const expectedSnapshot = snapshotState.probeExpectedSnapshot({
      testName,
      testId,
      isInline,
      inlineSnapshot,
    })

    const reference = expectedSnapshot.data && snapshotState.snapshotUpdateState !== 'all'
      ? adapter.parseExpected(expectedSnapshot.data)
      : undefined
    const timedOut = timeout > 0
      ? new Promise<void>(r => setTimeout(r, timeout))
      : undefined
    const stableResult = await getStableSnapshot({
      adapter,
      poll,
      interval,
      timedOut,
      match: reference
        ? captured => adapter.match(captured, reference).pass
        : undefined,
    })

    if (!stableResult?.rendered) {
      expectedSnapshot.markAsChecked()
      // upper `expect.poll` manipulates error via `throwWithCause`,
      // so here we can directly throw `lastPollError` if exists.
      if (stableResult?.lastPollError) {
        throw stableResult.lastPollError
      }
      throw new Error('poll() did not produce a stable snapshot within the timeout')
    }

    const { actual, expected, key, pass } = snapshotState.matchDomain({
      testId,
      testName,
      received: stableResult.rendered,
      isInline,
      inlineSnapshot,
      error,
      isEqual: (existingSnapshot) => {
        const parsed = adapter.parseExpected(existingSnapshot)
        return adapter.match(stableResult.captured, parsed)
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

/**
 * Polls repeatedly until the value reaches a stable state.
 *
 * Compares consecutive rendered outputs from the current session —
 * when two consecutive polls produce the same rendered string,
 * the value is considered stable.
 *
 * Every `await` (poll call, interval delay) races against `timedOut`
 * so that hanging polls and delays are interrupted.
 */
async function getStableSnapshot(
  { adapter, poll, interval, timedOut, match }: {
    adapter: DomainSnapshotAdapter<any, any>
    poll: () => Promise<unknown> | unknown
    interval: number
    timedOut?: Promise<void>
    match?: (captured: unknown) => boolean
  },
) {
  let lastRendered: string | undefined
  let lastPollError: unknown
  let lastStable: { captured: unknown; rendered: string } | undefined

  while (true) {
    try {
      const pollResult = await raceWith(Promise.resolve(poll()), timedOut)
      if (!pollResult.ok) {
        break
      }
      const captured = adapter.capture(pollResult.value)
      const rendered = adapter.render(captured)
      if (lastRendered !== undefined && rendered === lastRendered) {
        lastStable = { captured, rendered }
        if (!match || match(captured)) {
          break
        }
      }
      else {
        lastRendered = rendered
        lastStable = undefined
      }
    }
    catch (pollError) {
      // poll() threw — reset stability baseline and retry
      lastRendered = undefined
      lastStable = undefined
      lastPollError = pollError
    }
    const delayed = await raceWith(
      new Promise<void>(r => setTimeout(r, interval)),
      timedOut,
    )
    if (!delayed.ok) {
      break
    }
  }

  return { ...lastStable, lastPollError }
}

/** Type-safe `Promise.race` — tells you which promise won. */
function raceWith<A, B>(
  promise: Promise<A>,
  other?: Promise<B>,
): Promise<{ ok: true; value: A } | { ok: false; value: B }> {
  const left = promise.then(value => ({ ok: true as const, value }))
  if (!other) {
    return left
  }
  return Promise.race([
    left,
    other.then(value => ({ ok: false as const, value })),
  ])
}

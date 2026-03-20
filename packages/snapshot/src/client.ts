import type { DomainMatchResult, DomainSnapshotAdapter } from './domain'
import type { RawSnapshotInfo } from './port/rawSnapshot'
import type { SnapshotResult, SnapshotStateOptions, SnapshotUpdateState } from './types'
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

    const stableResult = await waitForStableSnapshot({
      adapter,
      poll,
      interval,
    }, timeout)

    const reference = expectedSnapshot.data
      ? {
          data: expectedSnapshot.data,
          parsed: adapter.parseExpected(expectedSnapshot.data),
        }
      : undefined

    const outcome = determinePollOutcome({
      snapshot: stableResult,
      reference,
      adapter,
      updateSnapshot: snapshotState.snapshotUpdateState,
    })

    switch (outcome.type) {
      case 'unstable': {
        expectedSnapshot.markAsChecked()
        throw outcome.error
      }

      case 'matched-after-comparison':
      case 'needs-commit': {
        const matchResult = snapshotState.matchDomain({
          testId,
          testName,
          received: outcome.rendered,
          isInline,
          inlineSnapshot,
          error,
          isEqual: 'matchResult' in outcome
            ? () => outcome.matchResult
            : snapshot => adapter.match(outcome.captured, adapter.parseExpected(snapshot)),
        })
        if (!matchResult.pass) {
          throw createMismatchError(
            `Snapshot \`${matchResult.key || 'unknown'}\` mismatched`,
            snapshotState.expand,
            matchResult.actual?.trim(),
            matchResult.expected?.trim(),
          )
        }
        return
      }

      default: {
        outcome satisfies never
      }
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

// ── Poll-stable snapshot helpers ─────────────────────────────────────────────
// inspired by packages/browser/src/node/commands/screenshotMatcher/index.ts

/**
 * Discriminated union representing all possible outcomes of a poll snapshot.
 *
 * - `unstable`: polled value never stabilized within timeout
 * - `matched-after-comparison`: stable value matched after full comparison
 * - `needs-commit`: stable value needs to be committed (new, update, or mismatch)
 */
type PollOutcome
  = | { type: 'unstable'; error: unknown }
    | {
      type: 'matched-after-comparison'
      captured: unknown
      rendered: string
      matchResult: DomainMatchResult
    }
    | {
      type: 'needs-commit'
      captured: unknown
      rendered: string
    }

interface StablePollOptions {
  adapter: DomainSnapshotAdapter<any, any>
  poll: () => Promise<unknown> | unknown
  interval: number
}

/**
 * Polls until the rendered value stabilizes, with timeout handling.
 *
 * Wraps {@linkcode getStableSnapshot} with an abort controller that
 * triggers when the timeout expires. Returns `undefined` if the value never stabilizes.
 */
async function waitForStableSnapshot(
  options: StablePollOptions,
  timeout: number,
): Promise<{ captured: unknown; rendered: string } | undefined> {
  const abortController = new AbortController()
  const stable = getStableSnapshot(options, abortController.signal)
  if (timeout === 0) {
    return stable
  }
  const timeoutPromise = new Promise<undefined>((resolve) => {
    setTimeout(() => {
      abortController.abort()
      resolve(undefined)
    }, timeout)
  })
  return Promise.race([stable, timeoutPromise])
}

/**
 * Polls repeatedly until the value reaches a stable state.
 *
 * Compares consecutive rendered outputs from the current session —
 * when two consecutive polls produce the same rendered string,
 * the value is considered stable.
 */
async function getStableSnapshot(
  { adapter, poll, interval }: StablePollOptions,
  signal: AbortSignal,
): Promise<{ captured: unknown; rendered: string }> {
  let baselineRendered: string | undefined

  let lastCaptured: unknown
  let lastRendered: string | undefined

  while (!signal.aborted) {
    try {
      const received = await poll()
      lastCaptured = adapter.capture(received)
      lastRendered = adapter.render(lastCaptured)

      if (baselineRendered !== undefined && lastRendered === baselineRendered) {
        break
      }

      baselineRendered = lastRendered
    }
    catch {
      // TODO: error should be surfaced together with `unstable` result. (use Error.cause?)
      // poll() threw — reset stability baseline and retry
      baselineRendered = undefined
      lastCaptured = undefined
      lastRendered = undefined
    }

    await new Promise<void>(r => setTimeout(r, interval))
  }

  return { captured: lastCaptured, rendered: lastRendered! }
}

/**
 * Determines the outcome of a poll snapshot based on capture results and context.
 *
 * All branching logic lives here — single source of truth for "what happened".
 */
function determinePollOutcome({
  snapshot,
  reference,
  adapter,
  updateSnapshot,
}: {
  snapshot?: { captured: unknown; rendered: string }
  reference?: { data: string; parsed: unknown }
  adapter: DomainSnapshotAdapter<any, any>
  updateSnapshot: SnapshotUpdateState
}): PollOutcome {
  if (!snapshot) {
    return {
      type: 'unstable',
      error: new Error('poll() did not produce a stable snapshot within the timeout'),
    }
  }

  // No reference or update mode — commit the stable value as-is
  if (!reference || updateSnapshot === 'all') {
    return {
      type: 'needs-commit',
      captured: snapshot.captured,
      rendered: snapshot.rendered,
    }
  }

  // Compare stable value against reference
  const matchResult = adapter.match(snapshot.captured, reference.parsed)

  if (matchResult.pass) {
    return {
      type: 'matched-after-comparison',
      captured: snapshot.captured,
      rendered: snapshot.rendered,
      matchResult,
    }
  }

  return {
    type: 'needs-commit',
    captured: snapshot.captured,
    rendered: snapshot.rendered,
  }
}

import type { ChaiPlugin, MatcherState, SyncExpectationResult } from '@vitest/expect'
import type { Test } from '@vitest/runner'
import { chai, createAssertionMessage, equals, iterableEquality, recordAsyncExpect, subsetEquality, wrapAssertion } from '@vitest/expect'
import { getNames } from '@vitest/runner/utils'
import {
  addSerializer,
  SnapshotClient,
  stripSnapshotIndentation,
} from '@vitest/snapshot'
import { getWorkerState } from '../../runtime/utils'

let _client: SnapshotClient

export function getSnapshotClient(): SnapshotClient {
  if (!_client) {
    _client = new SnapshotClient({
      isEqual: (received, expected) => {
        return equals(received, expected, [iterableEquality, subsetEquality])
      },
    })
  }
  return _client
}

function getError(expected: () => void | Error, promise: string | undefined) {
  if (typeof expected !== 'function') {
    if (!promise) {
      throw new Error(
        `expected must be a function, received ${typeof expected}`,
      )
    }

    // when "promised", it receives thrown error
    return expected
  }

  try {
    expected()
  }
  catch (e) {
    return e
  }

  throw new Error('snapshot function didn\'t throw')
}

function getTestNames(test: Test) {
  return {
    filepath: test.file.filepath,
    name: getNames(test).slice(1).join(' > '),
    testId: test.id,
  }
}

function getAssertionName(assertion: Chai.Assertion): string {
  const name = chai.util.flag(assertion, '_name') as string | undefined
  if (!name) {
    throw new Error('Assertion name is not set. This is a bug in Vitest. Please, open a new issue with reproduction.')
  }
  return name
}

function getTest(obj: Chai.Assertion) {
  const test = chai.util.flag(obj, 'vitest-test')
  if (!test) {
    throw new Error(`'${getAssertionName(obj)}' cannot be used without test context`)
  }
  return test as Test
}

function validateAssertion(assertion: Chai.Assertion): void {
  if (chai.util.flag(assertion, 'negate')) {
    throw new Error(`${getAssertionName(assertion)} cannot be used with "not"`)
  }
}

export const SnapshotPlugin: ChaiPlugin = (chai, utils) => {
  for (const key of ['matchSnapshot', 'toMatchSnapshot']) {
    utils.addMethod(
      chai.Assertion.prototype,
      key,
      wrapAssertion(utils, key, function (
        this,
        propertiesOrHint?: object | string,
        hint?: string,
      ) {
        const result = toMatchSnapshotImpl({
          assertion: this,
          received: utils.flag(this, 'object'),
          ...normalizeArguments(propertiesOrHint, hint),
        })
        return assertMatchResult(result)
      }),
    )
  }

  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchFileSnapshot',
    function (this: Chai.Assertion, filepath: string, hint?: string) {
      // set name manually since it's not wrapped by wrapAssertion
      utils.flag(this, '_name', 'toMatchFileSnapshot')
      // validate early synchronously just not to break some existing tests
      validateAssertion(this)
      const resultPromise = toMatchFileSnapshotImpl({
        assertion: this,
        received: utils.flag(this, 'object'),
        filepath,
        hint,
      })
      const assertPromise = resultPromise.then(result => assertMatchResult(result))
      return recordAsyncExpect(
        getTest(this),
        assertPromise,
        createAssertionMessage(utils, this, true),
        new Error('resolves'),
        utils.flag(this, 'soft'),
      )
    },
  )

  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchInlineSnapshot',
    wrapAssertion(utils, 'toMatchInlineSnapshot', function __INLINE_SNAPSHOT_OFFSET_3__(
      this,
      propertiesOrInlineSnapshot?: object | string,
      inlineSnapshotOrHint?: string,
      hint?: string,
    ) {
      const result = toMatchSnapshotImpl({
        assertion: this,
        received: utils.flag(this, 'object'),
        isInline: true,
        ...normalizeInlineArguments(propertiesOrInlineSnapshot, inlineSnapshotOrHint, hint),
      })
      return assertMatchResult(result)
    }),
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toThrowErrorMatchingSnapshot',
    wrapAssertion(utils, 'toThrowErrorMatchingSnapshot', function (this, propertiesOrHint?: object | string, hint?: string) {
      validateAssertion(this)
      const received = utils.flag(this, 'object')
      const promise = utils.flag(this, 'promise') as string | undefined
      const result = toMatchSnapshotImpl({
        assertion: this,
        received: getError(received, promise),
        ...normalizeArguments(propertiesOrHint, hint),
      })
      return assertMatchResult(result)
    }),
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toThrowErrorMatchingInlineSnapshot',
    wrapAssertion(utils, 'toThrowErrorMatchingInlineSnapshot', function __INLINE_SNAPSHOT_OFFSET_3__(
      this,
      inlineSnapshotOrHint?: string,
      hint?: string,
    ) {
      validateAssertion(this)
      const received = utils.flag(this, 'object')
      const promise = utils.flag(this, 'promise') as string | undefined
      const result = toMatchSnapshotImpl({
        assertion: this,
        received: getError(received, promise),
        isInline: true,
        ...normalizeInlineArguments(undefined, inlineSnapshotOrHint, hint),
      })
      return assertMatchResult(result)
    }),
  )
  utils.addMethod(chai.expect, 'addSnapshotSerializer', addSerializer)
}

// toMatchSnapshot(propertiesOrHint?, hint?)
function normalizeArguments(
  propertiesOrHint?: object | string,
  hint?: string,
): { properties?: object; hint?: string } {
  if (typeof propertiesOrHint === 'string') {
    return { hint: propertiesOrHint }
  }
  return { properties: propertiesOrHint, hint }
}

// toMatchInlineSnapshot(propertiesOrInlineSnapshot?, inlineSnapshotOrHint?, hint?)
function normalizeInlineArguments(
  propertiesOrInlineSnapshot?: object | string,
  inlineSnapshotOrHint?: string,
  hint?: string,
): { properties?: object; inlineSnapshot?: string; hint?: string } {
  let inlineSnapshot: string | undefined
  if (typeof propertiesOrInlineSnapshot === 'string') {
    inlineSnapshot = stripSnapshotIndentation(propertiesOrInlineSnapshot)
    return { inlineSnapshot, hint: inlineSnapshotOrHint }
  }
  if (inlineSnapshotOrHint) {
    inlineSnapshot = stripSnapshotIndentation(inlineSnapshotOrHint)
  }
  return { properties: propertiesOrInlineSnapshot, inlineSnapshot, hint }
}

function toMatchSnapshotImpl(options: {
  assertion: Chai.Assertion
  received: unknown
  properties?: object
  hint?: string
  isInline?: boolean
  inlineSnapshot?: string
}): SyncExpectationResult {
  const { assertion } = options
  validateAssertion(assertion)
  const assertionName = getAssertionName(assertion)
  const test = getTest(assertion)
  return getSnapshotClient().match({
    received: options.received,
    properties: options.properties,
    message: options.hint,
    isInline: options.isInline,
    inlineSnapshot: options.inlineSnapshot,
    errorMessage: chai.util.flag(assertion, 'message'),
    // pass `assertionName` for inline snapshot stack probing
    assertionName,
    // set by async assertion (e.g. resolves/rejects) for inline snapshot stack probing
    error: chai.util.flag(assertion, 'error'),
    ...getTestNames(test),
  })
}

async function toMatchFileSnapshotImpl(options: {
  assertion: Chai.Assertion
  received: unknown
  filepath: string
  hint?: string
}): Promise<SyncExpectationResult> {
  const { assertion } = options
  validateAssertion(assertion)
  const test = getTest(assertion)
  const testNames = getTestNames(test)
  const snapshotState = getSnapshotClient().getSnapshotState(testNames.filepath)
  const rawSnapshotFile = await snapshotState.environment.resolveRawPath(testNames.filepath, options.filepath)
  const rawSnapshotContent = await snapshotState.environment.readSnapshotFile(rawSnapshotFile)
  return getSnapshotClient().match({
    received: options.received,
    message: options.hint,
    errorMessage: chai.util.flag(assertion, 'message'),
    rawSnapshot: {
      file: rawSnapshotFile,
      content: rawSnapshotContent ?? undefined,
    },
    ...testNames,
  })
}

function assertMatchResult(result: SyncExpectationResult): void {
  if (!result.pass) {
    throw Object.assign(new Error(result.message()), {
      actual: result.actual,
      expected: result.expected,
      diffOptions: {
        expand: getWorkerState().config.snapshotOptions.expand,
      },
    })
  }
}

/**
 * Composable for building custom snapshot matchers via `expect.extend`.
 * Call with `this` bound to the matcher state. Returns `{ pass, message }`
 * compatible with the custom matcher return contract.
 *
 * @example
 * ```ts
 * import { toMatchSnapshot } from 'vitest/runtime'
 *
 * expect.extend({
 *   toMatchTrimmedSnapshot(received: string) {
 *     return toMatchSnapshot.call(this, received.slice(0, 10))
 *   },
 * })
 * ```
 *
 * @experimental
 * @see https://vitest.dev/guide/snapshot.html#custom-snapshot-matchers
 */
export function toMatchSnapshot(
  this: MatcherState,
  received: unknown,
  propertiesOrHint?: object | string,
  hint?: string,
): SyncExpectationResult {
  return toMatchSnapshotImpl({
    assertion: this.__vitest_assertion__,
    received,
    ...normalizeArguments(propertiesOrHint, hint),
  })
}

/**
 * Composable for building custom inline snapshot matchers via `expect.extend`.
 * Call with `this` bound to the matcher state. Returns `{ pass, message }`
 * compatible with the custom matcher return contract.
 *
 * @example
 * ```ts
 * import { toMatchInlineSnapshot } from 'vitest/runtime'
 *
 * expect.extend({
 *   toMatchTrimmedInlineSnapshot(received: string, inlineSnapshot?: string) {
 *     return toMatchInlineSnapshot.call(this, received.slice(0, 10), inlineSnapshot)
 *   },
 * })
 * ```
 *
 * @experimental
 * @see https://vitest.dev/guide/snapshot.html#custom-snapshot-matchers
 */
export function toMatchInlineSnapshot(
  this: MatcherState,
  received: unknown,
  propertiesOrInlineSnapshot?: object | string,
  inlineSnapshotOrHint?: string,
  hint?: string,
): SyncExpectationResult {
  return toMatchSnapshotImpl({
    assertion: this.__vitest_assertion__,
    received,
    isInline: true,
    ...normalizeInlineArguments(propertiesOrInlineSnapshot, inlineSnapshotOrHint, hint),
  })
}

/**
 * Composable for building custom file snapshot matchers via `expect.extend`.
 * Call with `this` bound to the matcher state. Returns a `Promise<{ pass, message }>`
 * compatible with the custom matcher return contract.
 *
 * @example
 * ```ts
 * import { toMatchFileSnapshot } from 'vitest/runtime'
 *
 * expect.extend({
 *   async toMatchTrimmedFileSnapshot(received: string, file: string) {
 *     return toMatchFileSnapshot.call(this, received.slice(0, 10), file)
 *   },
 * })
 * ```
 *
 * @experimental
 * @see https://vitest.dev/guide/snapshot.html#custom-snapshot-matchers
 */
export function toMatchFileSnapshot(
  this: MatcherState,
  received: unknown,
  filepath: string,
  hint?: string,
): Promise<SyncExpectationResult> {
  return toMatchFileSnapshotImpl({
    assertion: this.__vitest_assertion__,
    received,
    filepath,
    hint,
  })
}

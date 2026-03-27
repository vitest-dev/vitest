import type { Assertion, ChaiPlugin, MatcherState, SyncExpectationResult } from '@vitest/expect'
import type { Test } from '@vitest/runner'
import { createAssertionMessage, equals, iterableEquality, recordAsyncExpect, subsetEquality, wrapAssertion } from '@vitest/expect'
import { getNames } from '@vitest/runner/utils'
import {
  addSerializer,
  SnapshotClient,
  stripSnapshotIndentation,
} from '@vitest/snapshot'

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

function assertMatchResult(result: SyncExpectationResult): void {
  if (!result.pass) {
    throw Object.assign(new Error(result.message()), {
      actual: result.actual,
      expected: result.expected,
      // TODO: diffOptions
    })
  }
}

export const SnapshotPlugin: ChaiPlugin = (chai, utils) => {
  function getTest(assertionName: string, obj: object) {
    const test = utils.flag(obj, 'vitest-test')
    if (!test) {
      throw new Error(`'${assertionName}' cannot be used without test context`)
    }
    return test as Test
  }

  for (const key of ['matchSnapshot', 'toMatchSnapshot']) {
    utils.addMethod(
      chai.Assertion.prototype,
      key,
      wrapAssertion(utils, key, function (
        this,
        properties?: object,
        message?: string,
      ) {
        const received = utils.flag(this, 'object')
        assertMatchResult(
          toMatchSnapshotImpl(this, utils, key, received, properties, message),
        )
      }),
    )
  }

  // TODO: expose custom matcher equivalent?
  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchFileSnapshot',
    function (this: Assertion, file: string, message?: string) {
      utils.flag(this, '_name', 'toMatchFileSnapshot')
      const isNot = utils.flag(this, 'negate')
      if (isNot) {
        throw new Error('toMatchFileSnapshot cannot be used with "not"')
      }
      const error = new Error('resolves')
      const expected = utils.flag(this, 'object')
      const test = getTest('toMatchFileSnapshot', this)
      const errorMessage = utils.flag(this, 'message')

      const promise = getSnapshotClient().assertRaw({
        received: expected,
        message,
        isInline: false,
        rawSnapshot: {
          file,
        },
        errorMessage,
        ...getTestNames(test),
      })

      return recordAsyncExpect(
        test,
        promise,
        createAssertionMessage(utils, this, true),
        error,
        utils.flag(this, 'soft'),
      )
    },
  )

  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchInlineSnapshot',
    wrapAssertion(utils, 'toMatchInlineSnapshot', function __INLINE_SNAPSHOT_OFFSET_3__(
      this,
      properties?: object,
      inlineSnapshot?: string,
      message?: string,
    ) {
      const received = utils.flag(this, 'object')
      assertMatchResult(
        toMatchInlineSnapshotImpl(this, utils, 'toMatchInlineSnapshot', received, properties, inlineSnapshot, message),
      )
    }),
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toThrowErrorMatchingSnapshot',
    wrapAssertion(utils, 'toThrowErrorMatchingSnapshot', function (this, properties?: object, message?: string) {
      const expected = utils.flag(this, 'object')
      const promise = utils.flag(this, 'promise') as string | undefined
      assertMatchResult(
        toMatchSnapshotImpl(this, utils, 'toThrowErrorMatchingSnapshot', getError(expected, promise), properties, message),
      )
    }),
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toThrowErrorMatchingInlineSnapshot',
    wrapAssertion(utils, 'toThrowErrorMatchingInlineSnapshot', function __INLINE_SNAPSHOT_OFFSET_3__(
      this,
      inlineSnapshot: string,
      message: string,
    ) {
      const expected = utils.flag(this, 'object')
      const promise = utils.flag(this, 'promise') as string | undefined
      assertMatchResult(
        toMatchInlineSnapshotImpl(this, utils, 'toThrowErrorMatchingInlineSnapshot', getError(expected, promise), undefined, inlineSnapshot, message),
      )
    }),
  )
  utils.addMethod(chai.expect, 'addSnapshotSerializer', addSerializer)
}

// TODO: option object as argument
// TODO: flag to switch throwing vs non-throwing
function toMatchSnapshotImpl(
  assertion: Chai.AssertionStatic & Chai.Assertion,
  utils: Chai.ChaiUtils,
  assertionName: string,
  received: unknown,
  propertiesOrHint?: object,
  hint?: string,
): SyncExpectationResult {
  utils.flag(assertion, '_name', assertionName)
  const isNot = utils.flag(assertion, 'negate')
  if (isNot) {
    throw new Error(`${assertionName} cannot be used with "not"`)
  }
  const test = utils.flag(assertion, 'vitest-test') as Test | undefined
  if (!test) {
    throw new Error(`'${assertionName}' cannot be used without test context`)
  }
  if (typeof propertiesOrHint === 'string' && typeof hint === 'undefined') {
    hint = propertiesOrHint
    propertiesOrHint = undefined
  }
  return getSnapshotClient().match({
    received,
    message: hint,
    isInline: false,
    properties: propertiesOrHint,
    errorMessage: utils.flag(assertion, 'message'),
    ...getTestNames(test),
  })
}

function toMatchInlineSnapshotImpl(
  assertion: Chai.AssertionStatic & Chai.Assertion,
  utils: Chai.ChaiUtils,
  assertionName: string,
  received: unknown,
  propertiesOrHint?: object | string,
  inlineSnapshot?: string,
  hint?: string,
): SyncExpectationResult {
  utils.flag(assertion, '_name', assertionName)
  const isNot = utils.flag(assertion, 'negate')
  if (isNot) {
    throw new Error(`${assertionName} cannot be used with "not"`)
  }
  const test = utils.flag(assertion, 'vitest-test') as Test | undefined
  if (!test) {
    throw new Error(`'${assertionName}' cannot be used without test context`)
  }
  if (typeof propertiesOrHint === 'string') {
    hint = inlineSnapshot
    inlineSnapshot = propertiesOrHint
    propertiesOrHint = undefined
  }
  if (inlineSnapshot) {
    inlineSnapshot = stripSnapshotIndentation(inlineSnapshot)
  }
  return getSnapshotClient().match({
    received,
    message: hint,
    isInline: true,
    properties: propertiesOrHint,
    inlineSnapshot,
    errorMessage: utils.flag(assertion, 'message'),
    // pass `assertionName` to help stack probing
    assertionName,
    // set by async assertion (e.g. resolves/rejects) for stack probing
    error: utils.flag(assertion, 'error'),
    ...getTestNames(test),
  })
}

/**
 * Composable for building custom snapshot matchers via `expect.extend`.
 * Call with `this` bound to the matcher state. Returns `{ pass, message }`
 * compatible with the custom matcher return contract.
 *
 * The assertion name is automatically inferred from the `expect.extend` key,
 * so file snapshots use the custom matcher name as the snapshot key prefix.
 *
 * @example
 * ```ts
 * import { toMatchSnapshot } from 'vitest/runtime'
 *
 * expect.extend({
 *   toMatchTrimmedSnapshot(received: string, length: number) {
 *     return toMatchSnapshot.call(this, received.slice(0, length))
 *   },
 * })
 * ```
 *
 * @see https://vitest.dev/guide/snapshot.html#custom-snapshot-matchers
 */
export function toMatchSnapshot(
  this: MatcherState,
  received: unknown,
  propertiesOrHint?: object,
  hint?: string,
): SyncExpectationResult {
  return toMatchSnapshotImpl(
    this.__vitest_context__.chaiAssertion,
    this.__vitest_context__.chaiUtils,
    this.__vitest_context__.assertionName,
    received,
    propertiesOrHint,
    hint,
  )
}

/**
 * Composable for building custom inline snapshot matchers via `expect.extend`.
 * Call with `this` bound to the matcher state. Returns `{ pass, message }`
 * compatible with the custom matcher return contract.
 *
 * The assertion name is automatically inferred from the `expect.extend` key,
 * so inline snapshots are rewritten using the custom matcher name.
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
 * @see https://vitest.dev/guide/snapshot.html#custom-snapshot-matchers
 */
export function toMatchInlineSnapshot(
  this: MatcherState,
  received: unknown,
  propertiesOrHint?: object | string,
  inlineSnapshot?: string,
  hint?: string,
): SyncExpectationResult {
  return toMatchInlineSnapshotImpl(
    this.__vitest_context__.chaiAssertion,
    this.__vitest_context__.chaiUtils,
    this.__vitest_context__.assertionName,
    received,
    propertiesOrHint,
    inlineSnapshot,
    hint,
  )
}

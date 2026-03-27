import type { Assertion, ChaiPlugin, MatcherState, SyncExpectationResult } from '@vitest/expect'
import type { Test } from '@vitest/runner'
import { createAssertionMessage, equals, iterableEquality, recordAsyncExpect, subsetEquality, wrapAssertion } from '@vitest/expect'
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
        propertiesOrHint?: object | string,
        hint?: string,
      ) {
        toMatchSnapshotImpl({
          assertion: this,
          utils,
          assertionName: key,
          assert: true,
          received: utils.flag(this, 'object'),
          ...normalizeArguments(propertiesOrHint, hint),
        })
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
      propertiesOrInlineSnapshot?: object | string,
      inlineSnapshotOrHint?: string,
      hint?: string,
    ) {
      toMatchSnapshotImpl({
        assertion: this,
        utils,
        assertionName: 'toMatchInlineSnapshot',
        assert: true,
        received: utils.flag(this, 'object'),
        isInline: true,
        ...normalizeInlineArguments(propertiesOrInlineSnapshot, inlineSnapshotOrHint, hint),
      })
    }),
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toThrowErrorMatchingSnapshot',
    wrapAssertion(utils, 'toThrowErrorMatchingSnapshot', function (this, propertiesOrHint?: object | string, hint?: string) {
      const expected = utils.flag(this, 'object')
      const promise = utils.flag(this, 'promise') as string | undefined
      toMatchSnapshotImpl({
        assertion: this,
        utils,
        assertionName: 'toThrowErrorMatchingSnapshot',
        assert: true,
        received: getError(expected, promise),
        ...normalizeArguments(propertiesOrHint, hint),
      })
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
      const expected = utils.flag(this, 'object')
      const promise = utils.flag(this, 'promise') as string | undefined
      toMatchSnapshotImpl({
        assertion: this,
        utils,
        assertionName: 'toThrowErrorMatchingInlineSnapshot',
        assert: true,
        received: getError(expected, promise),
        isInline: true,
        ...normalizeInlineArguments(undefined, inlineSnapshotOrHint, hint),
      })
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
  if (typeof propertiesOrInlineSnapshot === 'string') {
    return { inlineSnapshot: propertiesOrInlineSnapshot, hint: inlineSnapshotOrHint }
  }
  return { properties: propertiesOrInlineSnapshot, inlineSnapshot: inlineSnapshotOrHint, hint }
}

function toMatchSnapshotImpl(options: {
  assertion: Chai.AssertionStatic & Chai.Assertion
  utils: Chai.ChaiUtils
  assertionName: string
  received: unknown
  assert?: boolean
  properties?: object
  hint?: string
  isInline?: boolean
  inlineSnapshot?: string
}): SyncExpectationResult {
  const { assertion, utils, assertionName, received, isInline } = options
  let { inlineSnapshot } = options

  utils.flag(assertion, '_name', assertionName)
  const isNot = utils.flag(assertion, 'negate')
  if (isNot) {
    throw new Error(`${assertionName} cannot be used with "not"`)
  }
  const test = utils.flag(assertion, 'vitest-test') as Test | undefined
  if (!test) {
    throw new Error(`'${assertionName}' cannot be used without test context`)
  }
  if (inlineSnapshot) {
    inlineSnapshot = stripSnapshotIndentation(inlineSnapshot)
  }
  const result = getSnapshotClient().match({
    received,
    message: options.hint,
    isInline,
    properties: options.properties,
    inlineSnapshot,
    errorMessage: utils.flag(assertion, 'message'),
    // pass `assertionName` for inline snapshot stack probing
    assertionName,
    // set by async assertion (e.g. resolves/rejects) for inline snapshot stack probing
    error: utils.flag(assertion, 'error'),
    ...getTestNames(test),
  })
  if (options.assert) {
    assertMatchResult(result)
  }
  return result
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
 * @see https://vitest.dev/guide/snapshot.html#custom-snapshot-matchers
 */
export function toMatchSnapshot(
  this: MatcherState,
  received: unknown,
  propertiesOrHint?: object | string,
  hint?: string,
): SyncExpectationResult {
  return toMatchSnapshotImpl({
    assertion: this.__vitest_context__.chaiAssertion,
    utils: this.__vitest_context__.chaiUtils,
    assertionName: this.__vitest_context__.assertionName,
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
    assertion: this.__vitest_context__.chaiAssertion,
    utils: this.__vitest_context__.chaiUtils,
    assertionName: this.__vitest_context__.assertionName,
    received,
    isInline: true,
    ...normalizeInlineArguments(propertiesOrInlineSnapshot, inlineSnapshotOrHint, hint),
  })
}

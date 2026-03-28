import type { Assertion, ChaiPlugin, MatcherState, SyncExpectationResult } from '@vitest/expect'
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

function getTest(obj: Chai.Assertion, assertionName: string) {
  const test = chai.util.flag(obj, 'vitest-test')
  if (!test) {
    throw new Error(`'${assertionName}' cannot be used without test context`)
  }
  return test as Test
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
        toMatchSnapshotImpl({
          assertion: this,
          assertionName: key,
          assert: true,
          received: utils.flag(this, 'object'),
          ...normalizeArguments(propertiesOrHint, hint),
        })
      }),
    )
  }

  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchFileSnapshot',
    function (this: Chai.AssertionStatic & Assertion, filepath: string, hint?: string) {
      const assertionName = 'toMatchFileSnapshot'
      const isNot = utils.flag(this, 'negate')
      if (isNot) {
        throw new Error(`${assertionName} cannot be used with "not"`)
      }
      const promise = toMatchFileSnapshotImpl({
        assertion: this,
        assertionName,
        received: utils.flag(this, 'object'),
        filepath,
        hint,
        assert: true,
      })
      return recordAsyncExpect(
        getTest(this, 'toMatchFileSnapshot'),
        promise,
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
      toMatchSnapshotImpl({
        assertion: this,
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
      const assertionName = 'toThrowErrorMatchingSnapshot'
      const isNot = utils.flag(this, 'negate')
      if (isNot) {
        throw new Error(`${assertionName} cannot be used with "not"`)
      }
      const received = utils.flag(this, 'object')
      const promise = utils.flag(this, 'promise') as string | undefined
      toMatchSnapshotImpl({
        assertion: this,
        assertionName: 'toThrowErrorMatchingSnapshot',
        assert: true,
        received: getError(received, promise),
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
      const assertionName = 'toThrowErrorMatchingInlineSnapshot'
      const isNot = utils.flag(this, 'negate')
      if (isNot) {
        throw new Error(`${assertionName} cannot be used with "not"`)
      }
      const received = utils.flag(this, 'object')
      const promise = utils.flag(this, 'promise') as string | undefined
      toMatchSnapshotImpl({
        assertion: this,
        assertionName,
        assert: true,
        received: getError(received, promise),
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
  assertion: Chai.AssertionStatic & Chai.Assertion
  assertionName: string
  received: unknown
  assert?: boolean
  properties?: object
  hint?: string
  isInline?: boolean
  inlineSnapshot?: string
}): SyncExpectationResult {
  const { assertion, assertionName } = options

  chai.util.flag(assertion, '_name', assertionName) // TODO: move to caller and jest-extend?
  const isNot = chai.util.flag(assertion, 'negate')
  if (isNot) {
    throw new Error(`${assertionName} cannot be used with "not"`)
  }

  const test = getTest(assertion, assertionName)
  const result = getSnapshotClient().match({
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
  if (options.assert) {
    assertMatchResult(result)
  }
  return result
}

async function toMatchFileSnapshotImpl(options: {
  assertion: Chai.AssertionStatic & Chai.Assertion
  assertionName: string
  received: unknown
  filepath: string
  hint?: string
  assert?: boolean
}): Promise<SyncExpectationResult> {
  const { assertion, assertionName } = options

  chai.util.flag(assertion, '_name', assertionName)
  const isNot = chai.util.flag(assertion, 'negate')
  if (isNot) {
    throw new Error(`${assertionName} cannot be used with "not"`)
  }

  const test = getTest(assertion, assertionName)
  const testNames = getTestNames(test)
  const snapshotState = getSnapshotClient().getSnapshotState(testNames.filepath)
  const rawSnapshotFile = await snapshotState.environment.resolveRawPath(testNames.filepath, options.filepath)
  const rawSnapshotContent = await snapshotState.environment.readSnapshotFile(rawSnapshotFile)

  const result = getSnapshotClient().match({
    received: options.received,
    message: options.hint,
    errorMessage: chai.util.flag(assertion, 'message'),
    rawSnapshot: {
      file: rawSnapshotFile,
      content: rawSnapshotContent ?? undefined,
    },
    ...testNames,
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

    assertionName: this.__vitest_context__.assertionName,
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
 * @see https://vitest.dev/guide/snapshot.html#custom-snapshot-matchers
 */
export function toMatchFileSnapshot(
  this: MatcherState,
  received: unknown,
  filepath: string,
  hint?: string,
): Promise<SyncExpectationResult> {
  return toMatchFileSnapshotImpl({
    assertion: this.__vitest_context__.chaiAssertion,

    assertionName: this.__vitest_context__.assertionName,
    received,
    filepath,
    hint,
  })
}

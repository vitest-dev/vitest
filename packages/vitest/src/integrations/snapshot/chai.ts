import type { Assertion, ChaiPlugin, MatcherState } from '@vitest/expect'
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
        utils.flag(this, '_name', key)
        const isNot = utils.flag(this, 'negate')
        if (isNot) {
          throw new Error(`${key} cannot be used with "not"`)
        }
        const expected = utils.flag(this, 'object')
        const test = getTest(key, this)
        if (typeof properties === 'string' && typeof message === 'undefined') {
          message = properties
          properties = undefined
        }
        const errorMessage = utils.flag(this, 'message')
        getSnapshotClient().assert({
          received: expected,
          message,
          isInline: false,
          properties,
          errorMessage,
          ...getTestNames(test),
        })
      }),
    )
  }

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
      utils.flag(this, '_name', 'toMatchInlineSnapshot')
      const isNot = utils.flag(this, 'negate')
      if (isNot) {
        throw new Error('toMatchInlineSnapshot cannot be used with "not"')
      }
      const test = getTest('toMatchInlineSnapshot', this)
      const expected = utils.flag(this, 'object')
      const error = utils.flag(this, 'error')
      if (typeof properties === 'string') {
        message = inlineSnapshot
        inlineSnapshot = properties
        properties = undefined
      }
      if (inlineSnapshot) {
        inlineSnapshot = stripSnapshotIndentation(inlineSnapshot)
      }
      const errorMessage = utils.flag(this, 'message')

      getSnapshotClient().assert({
        received: expected,
        message,
        isInline: true,
        properties,
        inlineSnapshot,
        error,
        errorMessage,
        ...getTestNames(test),
      })
    }),
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toThrowErrorMatchingSnapshot',
    wrapAssertion(utils, 'toThrowErrorMatchingSnapshot', function (this, properties?: object, message?: string) {
      utils.flag(this, '_name', 'toThrowErrorMatchingSnapshot')
      const isNot = utils.flag(this, 'negate')
      if (isNot) {
        throw new Error(
          'toThrowErrorMatchingSnapshot cannot be used with "not"',
        )
      }
      const expected = utils.flag(this, 'object')
      const test = getTest('toThrowErrorMatchingSnapshot', this)
      const promise = utils.flag(this, 'promise') as string | undefined
      const errorMessage = utils.flag(this, 'message')
      getSnapshotClient().assert({
        received: getError(expected, promise),
        message,
        errorMessage,
        ...getTestNames(test),
      })
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
      const isNot = utils.flag(this, 'negate')
      if (isNot) {
        throw new Error(
          'toThrowErrorMatchingInlineSnapshot cannot be used with "not"',
        )
      }
      const test = getTest('toThrowErrorMatchingInlineSnapshot', this)
      const expected = utils.flag(this, 'object')
      const error = utils.flag(this, 'error')
      const promise = utils.flag(this, 'promise') as string | undefined
      const errorMessage = utils.flag(this, 'message')

      if (inlineSnapshot) {
        inlineSnapshot = stripSnapshotIndentation(inlineSnapshot)
      }

      getSnapshotClient().assert({
        received: getError(expected, promise),
        message,
        inlineSnapshot,
        isInline: true,
        error,
        errorMessage,
        ...getTestNames(test),
      })
    }),
  )
  utils.addMethod(chai.expect, 'addSnapshotSerializer', addSerializer)
}

// TODO: use impl for above builtin snapshot API too.
function toMatchSnapshotImpl(
  assertion: Chai.AssertionStatic & Chai.Assertion,
  utils: Chai.ChaiUtils,
  assertionName: string,
  received: unknown,
  propertiesOrHint?: object,
  hint?: string,
): void {
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
  // TODO: implement non-throwing variant for jest matcher convention (likely SnapshotClient.match)
  getSnapshotClient().assert({
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
) {
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
  // TODO: non-throwing
  getSnapshotClient().assert({
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

export function toMatchSnapshot(
  this: MatcherState,
  received: unknown,
  propertiesOrHint?: object,
  hint?: string,
): void {
  return toMatchSnapshotImpl(
    this.__vitest_context.chaiAssertion,
    this.__vitest_context.chaiUtils,
    this.__vitest_context.assertionName,
    received,
    propertiesOrHint,
    hint,
  )
}

export function toMatchInlineSnapshot(
  this: MatcherState,
  received: unknown,
  propertiesOrHint?: object | string,
  inlineSnapshot?: string,
  hint?: string,
): void {
  return toMatchInlineSnapshotImpl(
    this.__vitest_context.chaiAssertion,
    this.__vitest_context.chaiUtils,
    this.__vitest_context.assertionName,
    received,
    propertiesOrHint,
    inlineSnapshot,
    hint,
  )
}

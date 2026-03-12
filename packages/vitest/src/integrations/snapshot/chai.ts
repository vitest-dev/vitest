import type { Assertion, ChaiPlugin } from '@vitest/expect'
import type { Test } from '@vitest/runner'
import type { DomainSnapshotAdapter } from '@vitest/snapshot'
import { createAssertionMessage, equals, iterableEquality, recordAsyncExpect, subsetEquality, wrapAssertion } from '@vitest/expect'
import { getNames } from '@vitest/runner/utils'
import {
  addDomain,
  addSerializer,
  getDomain,
  SnapshotClient,
  stripSnapshotIndentation,
} from '@vitest/snapshot'
import { ariaDomainAdapter } from '@vitest/snapshot/aria'

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

  function resolveDomainAdapter(domain: string, methodName: string): DomainSnapshotAdapter<any, any> {
    if (typeof domain !== 'string' || !domain) {
      throw new Error(`${methodName} expects a non-empty domain name as the first argument`)
    }
    const adapter = getDomain(domain)
    if (!adapter) {
      throw new Error(`Snapshot domain "${domain}" is not registered.`)
    }
    return adapter
  }

  function assertDomainSnapshot(self: object, name: string, adapter: DomainSnapshotAdapter<any, any>, opts: {
    inline: boolean
    inlineSnapshot?: string
    message?: string
  }) {
    utils.flag(self, '_name', name)
    const isNot = utils.flag(self, 'negate')
    if (isNot) {
      throw new Error(`${name} cannot be used with "not"`)
    }
    const test = getTest(name, self)

    let { inlineSnapshot } = opts
    if (inlineSnapshot) {
      inlineSnapshot = stripSnapshotIndentation(inlineSnapshot)
    }

    const pollFn = utils.flag(self, '_poll.fn') as (() => Promise<unknown> | unknown) | undefined
    if (pollFn) {
      return getSnapshotClient().pollAssertDomain({
        poll: pollFn,
        adapter,
        message: opts.message,
        isInline: opts.inline,
        errorMessage: utils.flag(self, 'message'),
        timeout: utils.flag(self, '_poll.timeout') as number | undefined,
        interval: utils.flag(self, '_poll.interval') as number | undefined,
        ...(opts.inline ? { inlineSnapshot, error: utils.flag(self, 'error') } : {}),
        ...getTestNames(test),
      })
    }

    return getSnapshotClient().assertDomain({
      received: utils.flag(self, 'object'),
      adapter,
      message: opts.message,
      isInline: opts.inline,
      errorMessage: utils.flag(self, 'message'),
      ...(opts.inline ? { inlineSnapshot, error: utils.flag(self, 'error') } : {}),
      ...getTestNames(test),
    })
  }

  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchDomainSnapshot',
    wrapAssertion(utils, 'toMatchDomainSnapshot', function (
      this,
      domain: string,
      message?: string,
    ) {
      return assertDomainSnapshot(
        this,
        'toMatchDomainSnapshot',
        resolveDomainAdapter(domain, 'toMatchDomainSnapshot'),
        { inline: false, message },
      )
    }),
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchDomainInlineSnapshot',
    wrapAssertion(utils, 'toMatchDomainInlineSnapshot', function __INLINE_SNAPSHOT_OFFSET_3__(
      this,
      inlineSnapshot: string,
      domain: string,
      message?: string,
    ) {
      // try/finally prevents WebKit proper tail call from eliminating this frame
      // https://webkit.org/blog/6240/ecmascript-6-proper-tail-calls-in-webkit
      try {
        return assertDomainSnapshot(
          this,
          'toMatchDomainInlineSnapshot',
          resolveDomainAdapter(domain, 'toMatchDomainInlineSnapshot'),
          { inline: true, inlineSnapshot, message },
        )
      }
      finally {
        // for webkit
      }
    }),
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchAriaSnapshot',
    wrapAssertion(utils, 'toMatchAriaSnapshot', function (this) {
      return assertDomainSnapshot(
        this,
        'toMatchAriaSnapshot',
        ariaDomainAdapter,
        { inline: false },
      )
    }),
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchAriaInlineSnapshot',
    wrapAssertion(utils, 'toMatchAriaInlineSnapshot', function __INLINE_SNAPSHOT_OFFSET_3__(
      this,
      inlineSnapshot?: string,
    ) {
      // try/finally prevents WebKit proper tail call from eliminating this frame
      // https://webkit.org/blog/6240/ecmascript-6-proper-tail-calls-in-webkit
      try {
        return assertDomainSnapshot(
          this,
          'toMatchAriaInlineSnapshot',
          ariaDomainAdapter,
          { inline: true, inlineSnapshot },
        )
      }
      finally {
        // for webkit
      }
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
  utils.addMethod(chai.expect, 'addSnapshotDomain', addDomain)
  addDomain(ariaDomainAdapter)
}

import type { ChaiPlugin } from '@vitest/expect'
import type { Test } from '@vitest/runner'
import { getNames } from '@vitest/runner/utils'
import type { SnapshotClient } from '@vitest/snapshot'
import { addSerializer, stripSnapshotIndentation } from '@vitest/snapshot'
import { recordAsyncExpect } from '../../../../expect/src/utils'
import { VitestSnapshotClient } from './client'

let _client: SnapshotClient

export function getSnapshotClient(): SnapshotClient {
  if (!_client)
    _client = new VitestSnapshotClient()
  return _client
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error)
    return err.message

  return err
}

function getErrorString(expected: () => void | Error, promise: string | undefined) {
  if (typeof expected !== 'function') {
    if (!promise)
      throw new Error(`expected must be a function, received ${typeof expected}`)

    // when "promised", it receives thrown error
    return getErrorMessage(expected)
  }

  try {
    expected()
  }
  catch (e) {
    return getErrorMessage(e)
  }

  throw new Error('snapshot function didn\'t throw')
}

export const SnapshotPlugin: ChaiPlugin = (chai, utils) => {
  const getTestNames = (test?: Test) => {
    if (!test)
      return {}
    return {
      filepath: test.file?.filepath,
      name: getNames(test).slice(1).join(' > '),
    }
  }

  for (const key of ['matchSnapshot', 'toMatchSnapshot']) {
    utils.addMethod(
      chai.Assertion.prototype,
      key,
      function (this: Record<string, unknown>, properties?: object, message?: string) {
        const expected = utils.flag(this, 'object')
        const test = utils.flag(this, 'vitest-test')
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
      },
    )
  }

  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchFileSnapshot',
    function (this: Record<string, unknown>, file: string, message?: string) {
      const expected = utils.flag(this, 'object')
      const test = utils.flag(this, 'vitest-test') as Test
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

      return recordAsyncExpect(test, promise)
    },
  )

  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchInlineSnapshot',
    function __INLINE_SNAPSHOT__(this: Record<string, unknown>, properties?: object, inlineSnapshot?: string, message?: string) {
      const test = utils.flag(this, 'vitest-test')
      const isInsideEach = test && (test.each || test.suite?.each)
      if (isInsideEach)
        throw new Error('InlineSnapshot cannot be used inside of test.each or describe.each')
      const expected = utils.flag(this, 'object')
      const error = utils.flag(this, 'error')
      if (typeof properties === 'string') {
        message = inlineSnapshot
        inlineSnapshot = properties
        properties = undefined
      }
      if (inlineSnapshot)
        inlineSnapshot = stripSnapshotIndentation(inlineSnapshot)
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
    },
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toThrowErrorMatchingSnapshot',
    function (this: Record<string, unknown>, message?: string) {
      const expected = utils.flag(this, 'object')
      const test = utils.flag(this, 'vitest-test')
      const promise = utils.flag(this, 'promise') as string | undefined
      const errorMessage = utils.flag(this, 'message')
      getSnapshotClient().assert({
        received: getErrorString(expected, promise),
        message,
        errorMessage,
        ...getTestNames(test),
      })
    },
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toThrowErrorMatchingInlineSnapshot',
    function __INLINE_SNAPSHOT__(this: Record<string, unknown>, inlineSnapshot: string, message: string) {
      const test = utils.flag(this, 'vitest-test')
      const isInsideEach = test && (test.each || test.suite?.each)
      if (isInsideEach)
        throw new Error('InlineSnapshot cannot be used inside of test.each or describe.each')
      const expected = utils.flag(this, 'object')
      const error = utils.flag(this, 'error')
      const promise = utils.flag(this, 'promise') as string | undefined
      const errorMessage = utils.flag(this, 'message')

      getSnapshotClient().assert({
        received: getErrorString(expected, promise),
        message,
        inlineSnapshot,
        isInline: true,
        error,
        errorMessage,
        ...getTestNames(test),
      })
    },
  )
  utils.addMethod(
    chai.expect,
    'addSnapshotSerializer',
    addSerializer,
  )
}

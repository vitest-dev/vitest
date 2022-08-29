import type { ChaiPlugin } from '../../types/chai'
import { SnapshotClient } from './client'
import { stripSnapshotIndentation } from './port/inlineSnapshot'

let _client: SnapshotClient

export function getSnapshotClient(): SnapshotClient {
  if (!_client)
    _client = new SnapshotClient()
  return _client
}

const getErrorMessage = (err: unknown) => {
  if (err instanceof Error)
    return err.message

  return err
}

const getErrorString = (expected: () => void | Error, promise: string | undefined) => {
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

  throw new Error('snapshot function didn\'t threw')
}

export const SnapshotPlugin: ChaiPlugin = (chai, utils) => {
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
          test,
          message,
          isInline: false,
          properties,
          errorMessage,
        })
      },
    )
  }
  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchInlineSnapshot',
    function __VITEST_INLINE_SNAPSHOT__(this: Record<string, unknown>, properties?: object, inlineSnapshot?: string, message?: string) {
      const expected = utils.flag(this, 'object')
      const error = utils.flag(this, 'error')
      const test = utils.flag(this, 'vitest-test')
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
        test,
        message,
        isInline: true,
        properties,
        inlineSnapshot,
        error,
        errorMessage,
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
        test,
        message,
        errorMessage,
      })
    },
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toThrowErrorMatchingInlineSnapshot',
    function __VITEST_INLINE_SNAPSHOT__(this: Record<string, unknown>, inlineSnapshot: string, message: string) {
      const expected = utils.flag(this, 'object')
      const error = utils.flag(this, 'error')
      const test = utils.flag(this, 'vitest-test')
      const promise = utils.flag(this, 'promise') as string | undefined
      const errorMessage = utils.flag(this, 'message')
      getSnapshotClient().assert({
        received: getErrorString(expected, promise),
        test,
        message,
        inlineSnapshot,
        isInline: true,
        error,
        errorMessage,
      })
    },
  )
}

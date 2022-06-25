import type { ChaiPlugin } from '../../types/chai'
import { SnapshotClient } from './client'
import { stripSnapshotIndentation } from './port/inlineSnapshot'

let _client: SnapshotClient

export function getSnapshotClient(): SnapshotClient {
  if (!_client)
    _client = new SnapshotClient()
  return _client
}

const getErrorString = (expected: () => void) => {
  try {
    expected()
  }
  catch (e) {
    if (e instanceof Error)
      return e.message

    return e
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
      const errorMessage = utils.flag(this, 'message')
      getSnapshotClient().assert({
        received: getErrorString(expected),
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
      const errorMessage = utils.flag(this, 'message')
      getSnapshotClient().assert({
        received: getErrorString(expected),
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

import type { ChaiPlugin } from '../chai/types'
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
      function(this: Record<string, unknown>, properties?: object, message?: string) {
        const expected = utils.flag(this, 'object')
        if (typeof properties === 'string' && typeof message === 'undefined') {
          message = properties
          properties = undefined
        }
        getSnapshotClient().assert(expected, message, false, properties)
      },
    )
  }
  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchInlineSnapshot',
    function __VITEST_INLINE_SNAPSHOT__(this: Record<string, unknown>, properties?: object, inlineSnapshot?: string, message?: string) {
      const expected = utils.flag(this, 'object')
      const error = utils.flag(this, 'error')
      if (typeof properties === 'string') {
        message = inlineSnapshot
        inlineSnapshot = properties
        properties = undefined
      }
      if (inlineSnapshot)
        inlineSnapshot = stripSnapshotIndentation(inlineSnapshot)
      getSnapshotClient().assert(expected, message, true, properties, inlineSnapshot, error)
    },
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toThrowErrorMatchingSnapshot',
    function(this: Record<string, unknown>, message?: string) {
      const expected = utils.flag(this, 'object')
      getSnapshotClient().assert(getErrorString(expected), message)
    },
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toThrowErrorMatchingInlineSnapshot',
    function __VITEST_INLINE_SNAPSHOT__(this: Record<string, unknown>, inlineSnapshot: string, message: string) {
      const expected = utils.flag(this, 'object')
      const error = utils.flag(this, 'error')
      getSnapshotClient().assert(getErrorString(expected), message, true, undefined, inlineSnapshot, error)
    },
  )
}

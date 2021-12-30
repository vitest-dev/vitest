import type { ChaiPlugin } from '../chai/types'
import { SnapshotClient } from './client'

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
      function(this: Record<string, unknown>, message?: string) {
        const expected = utils.flag(this, 'object')
        getSnapshotClient().assert(expected, message)
      },
    )
  }
  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchInlineSnapshot',
    function(this: Record<string, unknown>, inlineSnapshot: string, message: string) {
      const expected = utils.flag(this, 'object')
      getSnapshotClient().assert(expected, message, true, inlineSnapshot)
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
    function(this: Record<string, unknown>, inlineSnapshot: string, message: string) {
      const expected = utils.flag(this, 'object')
      getSnapshotClient().assert(getErrorString(expected), message, true, inlineSnapshot)
    },
  )
}

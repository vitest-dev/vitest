import type { ChaiPlugin } from '../chai/types'
import { SnapshotClient } from './client'

let _client: SnapshotClient

export function getSnapshotClient(): SnapshotClient {
  if (!_client)
    _client = new SnapshotClient()
  return _client
}

export const SnapshotPlugin: ChaiPlugin = (chai, utils) => {
  for (const key of ['matchSnapshot', 'toMatchSnapshot']) {
    utils.addMethod(
      chai.Assertion.prototype,
      key,
      function(this: Record<string, unknown>, message: string) {
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
      getSnapshotClient().assert(expected, message, inlineSnapshot)
    },
  )
}

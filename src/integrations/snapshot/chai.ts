import type { ChaiPlugin } from '../chai/types'
import { SnapshotClient } from './client'

let _client: SnapshotClient

export function getSnapshotClient(): SnapshotClient {
  if (!_client)
    _client = new SnapshotClient()
  return _client
}

export function SnapshotPlugin(): ChaiPlugin {
  return function(chai, utils) {
    for (const key of ['matchSnapshot', 'toMatchSnapshot']) {
      utils.addMethod(
        chai.Assertion.prototype,
        key,
        function(this: Record<string, unknown>, message: string) {
          const expected = utils.flag(this, 'object')
          console.log({ expected })
          getSnapshotClient().assert(expected, message)
        },
      )
    }
    utils.addMethod(
      chai.Assertion.prototype,
      'toMatchInlineSnapshot',
      (expectSnapshot: unknown, message: string) => {
        getSnapshotClient().assert(expectSnapshot, message, true)
      },
    )
  }
}

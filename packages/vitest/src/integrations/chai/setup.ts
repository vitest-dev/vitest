import {
  chai,
  ChaiStyleAssertions,
  JestAsymmetricMatchers,
  JestChaiExpect,
  JestExtend,
  markExpectCalled,
} from '@vitest/expect'
import { SnapshotPlugin } from '../snapshot/chai'

chai.use(JestExtend)
chai.use(JestChaiExpect)
chai.use(ChaiStyleAssertions)
chai.use(SnapshotPlugin)
chai.use(JestAsymmetricMatchers)

const _assert = chai.Assertion.prototype.assert
chai.Assertion.prototype.assert = function (this: any, ...args: any[]) {
  markExpectCalled(chai.util, this)
  return (_assert as any).apply(this, args)
}

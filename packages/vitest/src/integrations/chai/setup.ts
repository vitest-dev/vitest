import {
  chai,
  ChaiStyleAssertions,
  JestAsymmetricMatchers,
  JestChaiExpect,
  JestExtend,
} from '@vitest/expect'
import { SnapshotPlugin } from '../snapshot/chai'

chai.use(JestExtend)
chai.use(JestChaiExpect)
chai.use(ChaiStyleAssertions)
chai.use(SnapshotPlugin)
chai.use(JestAsymmetricMatchers)

// Override Assertion.prototype.assert to track when any assertion (including
// chai native and 3rd-party plugin matchers) is invoked. This allows detecting
// `expect()` calls where no matcher was ever called.
const _assert = chai.Assertion.prototype.assert
chai.Assertion.prototype.assert = function (this: any, ...args: any[]) {
  const state = chai.util.flag(this, '_vitest_expect_state') as { called: boolean } | undefined
  if (state) {
    state.called = true
  }
  return (_assert as any).apply(this, args)
}

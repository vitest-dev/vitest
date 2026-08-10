import {
  chai,
  ChaiStyleAssertions,
  JestAsymmetricMatchers,
  JestChaiExpect,
  JestExtend,
} from '@vitest/expect'
import { MockPlugin } from '../mock/chai'
import { SnapshotPlugin } from '../snapshot/chai'

chai.use(JestExtend)
chai.use(JestChaiExpect)
chai.use(ChaiStyleAssertions)
chai.use(SnapshotPlugin)
chai.use(JestAsymmetricMatchers)
chai.use(MockPlugin)

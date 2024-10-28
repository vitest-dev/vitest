import {
  JestAsymmetricMatchers,
  JestChaiExpect,
  JestExtend,
} from '@vitest/expect'
import * as chai from 'chai'
import Subset from 'chai-subset'
import { SnapshotPlugin } from '../snapshot/chai'

chai.use(JestExtend)
chai.use(JestChaiExpect)
chai.use(Subset)
chai.use(SnapshotPlugin)
chai.use(JestAsymmetricMatchers)

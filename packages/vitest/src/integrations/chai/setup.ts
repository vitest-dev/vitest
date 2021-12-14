import chai from 'chai'
import SinonChai from 'sinon-chai'
import Subset from 'chai-subset'
import { SnapshotPlugin } from '../snapshot/chai'
import { JestExtend } from './jest-extend'
import { JestChaiExpect } from './jest-expect'
import { JestAsymmetricMatchers } from './jest-asymmetric-matchers'

let installed = false
export async function setupChai() {
  if (installed)
    return

  chai.use(SinonChai)
  chai.use(JestExtend())
  chai.use(JestChaiExpect())
  chai.use(Subset)
  chai.use(SnapshotPlugin())
  chai.use(SnapshotPlugin())
  chai.use(JestAsymmetricMatchers())
  installed = true
}

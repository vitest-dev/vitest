import chai from 'chai'
import SinonChai from 'sinon-chai'
import Subset from 'chai-subset'
import { ResolvedConfig } from 'vitest'
import { SnapshotPlugin } from '../snapshot'
import { JestChaiExpect } from './jest-expect'

export async function setupChai(config: ResolvedConfig) {
  chai.use(SinonChai)
  chai.use(JestChaiExpect())
  chai.use(Subset)
  chai.use(await SnapshotPlugin(config))
}

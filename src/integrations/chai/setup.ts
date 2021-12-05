import chai from 'chai'
import SinonChai from 'sinon-chai'
import { Config } from 'vitest'
import { JestChaiExpect } from './jest-expect'
import { SnapshotPlugin } from './snapshot'

export async function setupChai(config: Config) {
  chai.use(SinonChai)
  chai.use(JestChaiExpect())
  chai.use(await SnapshotPlugin({
    rootDir: config.rootDir || process.cwd(),
    update: config.updateSnapshot,
  }))
}

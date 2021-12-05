import Snap from 'jest-snapshot'
import { ChaiPlugin } from '../types'
import { SnapshotManager } from './manager'

const { addSerializer } = Snap

let _manager: SnapshotManager

export interface SnapshotOptions {
  rootDir: string
  update?: boolean
}

export function getSnapshotManager(): SnapshotManager {
  return _manager!
}

export async function SnapshotPlugin(options: SnapshotOptions): Promise<ChaiPlugin> {
  const { rootDir } = options

  _manager = new SnapshotManager({
    rootDir,
    update: options.update,
  })

  _manager.snapshotResolver = await Snap.buildSnapshotResolver({
    transform: [],
    rootDir,
  } as any)

  return function(chai, utils) {
    for (const key of ['matchSnapshot', 'toMatchSnapshot']) {
      utils.addMethod(
        chai.Assertion.prototype,
        key,
        function(this: Record<string, unknown>, message: string) {
          const expected = utils.flag(this, 'object')
          _manager.assert(expected, message)
        },
      )
    }
    chai.expect.addSnapshotSerializer = addSerializer as any
  }
}

import { use as chaiUse } from 'chai'
import Snap from 'jest-snapshot'
import { after, before, beforeEach } from '../hooks'
import { SnapshotManager } from './manager'

const { addSerializer } = Snap

type FirstFunctionArgument<T> = T extends (arg: infer A) => unknown ? A : never
type ChaiPlugin = FirstFunctionArgument<typeof chaiUse>

let _manager: SnapshotManager

export interface SnapshotOptions {
  rootDir: string
  update?: boolean
}

export function SnapshotPlugin(options: SnapshotOptions): ChaiPlugin {
  const { rootDir } = options

  _manager = new SnapshotManager({
    rootDir,
    update: options.update,
  })

  return function(chai, utils) {
    before(async() => {
      _manager.snapshotResolver = await Snap.buildSnapshotResolver({
        transform: [],
        rootDir,
      } as any)
    })
    beforeEach((task) => {
      _manager.setContext({
        file: task.file?.filepath || task.name,
        title: task.name,
        fullTitle: [task.suite.name, task.name].filter(Boolean).join(' > '),
      })
    })
    after(() => {
      _manager.saveSnap()
      _manager.report()
    })
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

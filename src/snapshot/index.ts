import { use as chaiUse } from 'chai'
import Snap from 'jest-snapshot'
import { afterAll, beforeEach } from '../hooks'
import { SnapshotManager } from './manager'

const { addSerializer } = Snap

type FirstFunctionArgument<T> = T extends (arg: infer A) => unknown ? A : never
type ChaiPlugin = FirstFunctionArgument<typeof chaiUse>

let _manager: SnapshotManager

export interface SnapshotOptions {
  rootDir: string
  update?: boolean
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
    beforeEach((task) => {
      _manager.setContext({
        file: task.file?.filepath || task.name,
        title: task.name,
        fullTitle: [task.suite.name, task.name].filter(Boolean).join(' > '),
      })
    })
    afterAll(() => {
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

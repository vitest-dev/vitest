import { importModule } from 'local-pkg'
import type { Environment } from '../../types'
import { populateGlobal } from './utils'

export default <Environment>({
  name: 'happy-dom',
  async setup(global) {
    // happy-dom v3 introduced a breaking change to Window, but
    // provides GlobalWindow as a way to use previous behaviour
    const { Window, GlobalWindow } = await importModule('happy-dom') as typeof import('happy-dom')
    const win = new (GlobalWindow || Window)()

    const { keys, allowRewrite } = populateGlobal(global, win, { bindFunctions: true })

    const originals = new Map<string | symbol, any>(
      allowRewrite.map(([key]) => [key, global[key]]),
    )

    return {
      teardown(global) {
        win.happyDOM.cancelAsync()
        keys.forEach(key => delete global[key])
        originals.forEach((v, k) => global[k] = v)
      },
    }
  },
})

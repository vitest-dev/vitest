import type { Environment } from '../../types'
import { populateGlobal } from './utils'

export default <Environment>({
  name: 'happy-dom',
  async setup(global) {
    const libName = 'happy-dom'
    // happy-dom v3 introduced a breaking change to Window, but
    // provides GlobalWindow as a way to use previous behaviour
    const { Window, GlobalWindow } = await import(libName) as typeof import('happy-dom')
    const win = new (GlobalWindow || Window)()

    const { keys, originals } = populateGlobal(global, win, { bindFunctions: true })

    return {
      teardown(global) {
        win.happyDOM.cancelAsync()
        keys.forEach(key => delete global[key])
        originals.forEach((v, k) => global[k] = v)
      },
    }
  },
})

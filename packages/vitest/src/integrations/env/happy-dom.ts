import { importModule } from 'local-pkg'
import type { Environment } from '../../types'
import { getWindowKeys } from './utils'

export default <Environment>({
  name: 'happy-dom',
  async setup(global) {
    // happy-dom v3 introduced a breaking change to Window, but
    // provides GlobalWindow as a way to use previous behaviour
    const { Window, GlobalWindow } = await importModule('happy-dom') as typeof import('happy-dom')
    const win: any = new (GlobalWindow || Window)()

    const keys = getWindowKeys(global, win)

    const overrideObject = new Map<string, any>()
    for (const key of keys) {
      Object.defineProperty(global, key, {
        get() {
          if (overrideObject.has(key))
            return overrideObject.get(key)
          return win[key]
        },
        set(v) {
          overrideObject.set(key, v)
        },
        configurable: true,
      })
    }

    return {
      teardown(global) {
        win.happyDOM.cancelAsync()
        keys.forEach(key => delete global[key])
      },
    }
  },
})

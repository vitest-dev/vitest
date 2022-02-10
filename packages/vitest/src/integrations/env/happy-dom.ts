import { importModule } from 'local-pkg'
import { defineInlineWorker } from '../../runtime/inline-worker'
import type { Environment } from '../../types'
import { KEYS } from './jsdom-keys'

export default <Environment>({
  name: 'happy-dom',
  async setup(global) {
    const { Window } = await importModule('happy-dom') as typeof import('happy-dom')
    const win: any = new Window()

    const keys = new Set(KEYS.concat(Object.getOwnPropertyNames(win))
      .filter(k => !k.startsWith('_') && !(k in global)))

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

    defineInlineWorker()

    return {
      teardown(global) {
        win.happyDOM.cancelAsync()
        keys.forEach(key => delete global[key])
      },
    }
  },
})

import { importModule } from 'local-pkg'
import type { Environment } from '../types'
import { KEYS } from './jsdom-keys'

export default <Environment>({
  name: 'happy-dom',
  async setup(global) {
    const { Window } = await importModule('happy-dom') as typeof import('happy-dom')
    const win: any = new Window()

    const keys = new Set(KEYS.concat(Object.getOwnPropertyNames(win))
      .filter(k => !k.startsWith('_') && !(k in global)))

    const overrideObject: Record<string, any> = {}
    for (const key of keys) {
      Object.defineProperty(global, key, {
        get() {
          if (key in overrideObject)
            return overrideObject[key]
          return win[key]
        },
        set(v) {
          overrideObject[key] = v
        },
        configurable: true,
      })
    }

    global.window = global

    return {
      teardown(global) {
        win.happyDOM.cancelAsync()
        keys.forEach(key => delete global[key])
      },
    }
  },
})

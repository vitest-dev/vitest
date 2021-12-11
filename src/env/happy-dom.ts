import { Environment } from '../types'
import { KEYS } from './jsdom-keys'

export default <Environment>({
  name: 'happy-dom',
  async setup(global) {
    const { Window } = await import('happy-dom')
    const win = new Window()

    const keys = KEYS.concat(Object.getOwnPropertyNames(win))
      .filter(k => !k.startsWith('_'))
      .filter(k => !(k in global))

    for (const key of keys)
      // @ts-expect-error
      global[key] = win[key]

    return {
      teardown(global) {
        win.happyDOM.cancelAsync()
        keys.forEach(key => delete global[key])
      },
    }
  },
})

import { Window } from 'happy-dom'
import { KEYS } from './keys'

export function setupHappyDOM(global: any) {
  const win = new Window()

  const keys = KEYS.concat(Object.getOwnPropertyNames(win))
    .filter(k => !k.startsWith('_'))
    .filter(k => !(k in global))

  for (const key of keys)
    // @ts-expect-error
    global[key] = win[key]

  return {
    dom: win,
    restore() {
      win.happyDOM.cancelAsync()
      keys.forEach(key => delete global[key])
    },
  }
}

import { KEYS } from './jsdom-keys'

const allowRewrite = new Set([
  'Event',
])

export function getWindowKeys(global: any, win: any) {
  const keys = new Set(KEYS.concat(Object.getOwnPropertyNames(win))
    .filter((k) => {
      if (k.startsWith('_')) return false
      if (k in global)
        return allowRewrite.has(k)

      return true
    }))

  return keys
}

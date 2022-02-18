import { getDescriptor } from '../../utils'
import { KEYS } from './jsdom-keys'

const filterKeys = new Set([
  'clearInterval',
  'clearTimeout',
  'setInterval',
  'setTimeout'
])

export function getWindowKeys(global: any, win: any) {
  const keys = new Set(KEYS.concat(Object.getOwnPropertyNames(win))
    .filter((k) => {
      if (k.startsWith('_')) return false
      if (k in global) {
        const descriptor = getDescriptor(global, k)
        if (!descriptor) return true
        return descriptor.configurable === true
      }
      return !filterKeys.has(k)
    }))

  return keys
}

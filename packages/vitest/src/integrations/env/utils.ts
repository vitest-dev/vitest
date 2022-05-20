import { KEYS } from './jsdom-keys'

const allowRewrite = [
  'Event',
  'EventTarget',
]

const skipKeys = [
  'window',
  'self',
  'top',
  'parent',
]

export function getWindowKeys(global: any, win: any) {
  const keys = new Set(KEYS.concat(Object.getOwnPropertyNames(win))
    .filter((k) => {
      if (k.startsWith('_') || skipKeys.includes(k))
        return false
      if (k in global)
        return allowRewrite.includes(k)

      return true
    }))

  return keys
}

function isClassLikeName(name: string) {
  return name[0] === name[0].toUpperCase()
}

interface PopulateOptions {
  bindFunctions?: boolean
}

export function populateGlobal(global: any, win: any, options: PopulateOptions = {}) {
  const { bindFunctions = false } = options
  const keys = getWindowKeys(global, win)

  const originals = new Map<string | symbol, any>(
    allowRewrite.map(([key]) => [key, global[key]]),
  )

  const overrideObject = new Map<string | symbol, any>()
  for (const key of keys) {
    const bindedFunction = bindFunctions && typeof win[key] === 'function' && !isClassLikeName(key) && win[key].bind(win)
    Object.defineProperty(global, key, {
      get() {
        if (overrideObject.has(key))
          return overrideObject.get(key)
        if (bindedFunction)
          return bindedFunction
        return win[key]
      },
      set(v) {
        overrideObject.set(key, v)
      },
      configurable: true,
    })
  }

  global.window = global
  global.self = global
  global.top = global

  if (global.global)
    global.global = global

  skipKeys.forEach(k => keys.add(k))

  return {
    keys,
    skipKeys,
    originals,
  }
}

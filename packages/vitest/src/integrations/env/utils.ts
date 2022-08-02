import { KEYS } from './jsdom-keys'

const allowRewrite = [
  'Event',
  'EventTarget',
  'MessageEvent',
  // implemented in Node 18
  'ArrayBuffer',
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
      if (skipKeys.includes(k))
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
    allowRewrite.filter(key => key in global).map(key => [key, global[key]]),
  )

  const overrideObject = new Map<string | symbol, any>()
  for (const key of keys) {
    // we bind functions such as addEventListener and others
    // because they rely on `this` in happy-dom, and in jsdom it
    // has a priority for getting implementaion from symbols
    // (global doesn't have these symbols, but window - does)
    const boundFunction = bindFunctions
      && typeof win[key] === 'function'
      && !isClassLikeName(key)
      && win[key].bind(win)

    Object.defineProperty(global, key, {
      get() {
        if (overrideObject.has(key))
          return overrideObject.get(key)
        if (boundFunction)
          return boundFunction
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
  global.parent = global

  if (global.global)
    global.global = global

  skipKeys.forEach(k => keys.add(k))

  return {
    keys,
    skipKeys,
    originals,
  }
}

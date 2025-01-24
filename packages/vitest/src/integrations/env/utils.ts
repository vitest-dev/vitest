import { KEYS } from './jsdom-keys'

const skipKeys = ['window', 'self', 'top', 'parent']

export function getWindowKeys(
  global: any,
  win: any,
  additionalKeys: string[] = [],
) {
  const keysArray = [...additionalKeys, ...KEYS]
  const keys = new Set(
    keysArray.concat(Object.getOwnPropertyNames(win)).filter((k) => {
      if (skipKeys.includes(k)) {
        return false
      }
      if (k in global) {
        return keysArray.includes(k)
      }

      return true
    }),
  )

  return keys
}

function isClassLikeName(name: string) {
  return name[0] === name[0].toUpperCase()
}

interface PopulateOptions {
  // we bind functions such as addEventListener and others
  // because they rely on `this` in happy-dom, and in jsdom it
  // has a priority for getting implementation from symbols
  // (global doesn't have these symbols, but window - does)
  bindFunctions?: boolean

  additionalKeys?: string[]
}

export function populateGlobal(
  global: any,
  win: any,
  options: PopulateOptions = {},
) {
  const { bindFunctions = false } = options
  const keys = getWindowKeys(global, win, options.additionalKeys)

  const originals = new Map<string | symbol, any>()

  const overrideObject = new Map<string | symbol, any>()
  for (const key of keys) {
    const boundFunction
      = bindFunctions
        && typeof win[key] === 'function'
        && !isClassLikeName(key)
        && win[key].bind(win)

    if (KEYS.includes(key) && key in global) {
      originals.set(key, global[key])
    }

    Object.defineProperty(global, key, {
      get() {
        if (overrideObject.has(key)) {
          return overrideObject.get(key)
        }
        if (boundFunction) {
          return boundFunction
        }
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

  if (global.global) {
    global.global = global
  }

  // rewrite defaultView to reference the same global context
  if (global.document && global.document.defaultView) {
    Object.defineProperty(global.document, 'defaultView', {
      get: () => global,
      enumerable: true,
      configurable: true,
    })
  }

  skipKeys.forEach(k => keys.add(k))

  return {
    keys,
    skipKeys,
    originals,
  }
}

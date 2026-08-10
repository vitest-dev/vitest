import { KEYS } from './jsdom-keys'

const skipKeys = ['window', 'self', 'top', 'parent']

export function getWindowKeys(
  global: any,
  win: any,
  additionalKeys: string[] = [],
): Set<string> {
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
): {
  keys: Set<string>
  skipKeys: string[]
  originals: Map<string | symbol, PropertyDescriptor>
} {
  const { bindFunctions = false } = options
  const keys = getWindowKeys(global, win, options.additionalKeys)

  const originals = new Map<string | symbol, PropertyDescriptor>()

  const overriddenKeys = new Set([...KEYS, ...options.additionalKeys || []])

  const overrideObject = new Map<string | symbol, any>()
  for (const key of keys) {
    const boundFunction
      = bindFunctions
        && typeof win[key] === 'function'
        && !isClassLikeName(key)
        && win[key].bind(win)

    if (overriddenKeys.has(key) && key in global) {
      // capture the descriptor instead of the value to avoid invoking native
      // lazy getters such as Node's `localStorage`, which warns when accessed
      // without `--localstorage-file`
      const descriptor = Object.getOwnPropertyDescriptor(global, key)
        ?? { value: global[key], configurable: true, writable: true, enumerable: true }
      originals.set(key, descriptor)
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
        // propagate changes to underlying window implementation,
        // which can affect other window API behavior internally, e.g.
        // updating `innerWidth` affects `matchMedia("(max-width: *)")` on happy-dom.
        win[key] = v
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

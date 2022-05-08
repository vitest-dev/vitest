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

interface PopulateOptions {
  bindFunctions?: boolean
}

export function populateGlobal(global: any, win: any, options: PopulateOptions = {}) {
  const { bindFunctions = false } = options
  const keys = getWindowKeys(global, win)

  const overrideObject = new Map<string | symbol, any>()
  for (const key of keys) {
    const shouldBind = bindFunctions && typeof win[key] === 'function'
    Object.defineProperty(global, key, {
      get() {
        if (overrideObject.has(key))
          return overrideObject.get(key)
        if (shouldBind)
          return win[key].bind(win)
        return win[key]
      },
      set(v) {
        overrideObject.set(key, v)
      },
      configurable: true,
    })
  }

  const globalKeys = new Set<string | symbol>(['window', 'self', 'top', 'parent'])

  // we are creating a proxy that intercepts all access to the global object,
  // stores new value on `override`, and returns only these values,
  // so it actually shares only values defined inside tests
  const globalProxy = new Proxy(win.window, {
    get(target, p, receiver) {
      if (overrideObject.has(p))
        return overrideObject.get(p)
      return Reflect.get(target, p, receiver)
    },
    set(target, p, value, receiver) {
      try {
        // if property is defined with "configurable: false",
        // this will throw an error, but `self.prop = value` should not throw
        // this matches browser behaviour where it silently ignores the error
        // and returns previously defined value, which is a hell for debugging
        Object.defineProperty(global, p, {
          get: () => overrideObject.get(p),
          set: value => overrideObject.set(p, value),
          configurable: true,
        })
        overrideObject.set(p, value)
        Reflect.set(target, p, value, receiver)
      }
      catch {
        // ignore
      }
      return true
    },
    deleteProperty(target, p) {
      Reflect.deleteProperty(global, p)
      overrideObject.delete(p)
      return Reflect.deleteProperty(target, p)
    },
    defineProperty(target, p, attributes) {
      if (attributes.writable && 'value' in attributes) {
        // skip - already covered by "set"
      }
      else if (attributes.get) {
        overrideObject.delete(p)
        Reflect.defineProperty(global, p, attributes)
      }
      return Reflect.defineProperty(target, p, attributes)
    },
  })

  globalKeys.forEach((key) => {
    if (!win[key])
      return

    Object.defineProperty(global, key, {
      get() {
        return globalProxy
      },
      configurable: true,
    })
  })

  const globalThisProxy = new Proxy(global.globalThis, {
    set(target, key, value, receiver) {
      overrideObject.set(key, value)
      return Reflect.set(target, key, value, receiver)
    },
    deleteProperty(target, key) {
      overrideObject.delete(key)
      return Reflect.deleteProperty(target, key)
    },
    defineProperty(target, p, attributes) {
      if (attributes.writable && 'value' in attributes) {
        // skip - already covered by "set"
      }
      else if (attributes.get && !globalKeys.has(p)) {
        globalKeys.forEach((key) => {
          if (win[key])
            Object.defineProperty(win[key], p, attributes)
        })
      }
      return Reflect.defineProperty(target, p, attributes)
    },
  })

  global.globalThis = globalThisProxy

  if (global.global)
    global.global = globalThisProxy

  skipKeys.forEach(k => keys.add(k))

  return {
    keys,
    skipKeys,
    allowRewrite,
  }
}

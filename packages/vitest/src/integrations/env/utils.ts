import { KEYS } from './jsdom-keys'

const allowRewrite = [
  'Event',
  'EventTarget',
]

const skipKeys = [
  'window',
  'self',
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

export function populateGlobal(global: any, win: any) {
  const keys = getWindowKeys(global, win)

  const overrideObject = new Map<string | symbol, any>()
  for (const key of keys) {
    Object.defineProperty(global, key, {
      get() {
        if (overrideObject.has(key))
          return overrideObject.get(key)
        return win[key]
      },
      set(v) {
        overrideObject.set(key, v)
      },
      configurable: true,
    })
  }

  const globalKeys = new Set<string | symbol>(['window', 'self', 'GLOBAL', 'global', 'top', 'parent'])

  globalKeys.forEach((key) => {
    if (!win[key])
      return

    const proxy = new Proxy(win[key], {
      get(target, p, receiver) {
        if (overrideObject.has(p))
          return overrideObject.get(p)
        return Reflect.get(target, p, receiver)
      },
      set(target, p, value, receiver) {
        try {
          // if property is defined with configurable: false,
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

    Object.defineProperty(global, key, {
      get() {
        return proxy
      },
      configurable: true,
    })
  })

  global.globalThis = new Proxy(global.globalThis, {
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

  skipKeys.forEach(k => keys.add(k))

  return {
    keys,
    skipKeys,
    allowRewrite,
  }
}

// this is just here so Proxy knows we're wrapping a function
function neverFunctionForProxy() {
  throw new Error(`should not get here`)
}

const originalSymbol = Symbol('orig')

// allows replacing 'function' types on this module: passes through to the 'current value'
function prepareFakeModuleForSpy(module: any) {
  for (const key in module) {
    let value: Function = module[key]
    if (typeof value !== 'function')
      continue

    try {
      delete module[key]
    }
    catch {
      continue
    }

    // uses Reflect to implement Proxy, but use 'current value' and not the original target
    const currentValueReflect = new Proxy(Reflect, {
      get(_reflect, reflectKey) {
        // TODO: does this support ctor mocking (new.target)
        return (...args: any[]) => (Reflect as any)[reflectKey](value, ...args.slice(1))
      },
    })
    const p = new Proxy(neverFunctionForProxy, currentValueReflect)

    const get = () => p
    get[originalSymbol] = true

    const set = (v: any) => value = v
    set[originalSymbol] = true

    Object.defineProperty(module, key, {
      get,
      set,
      enumerable: true,
      configurable: true,
    })
  }
}

// this enables bound-like named imports with the import rewriting scheme
export function buildFakeModule<T extends Record<string | symbol, any>>(contents: T): T {
  const out: Record<string | symbol, any> = { [Symbol.toStringTag]: 'Module', ...contents }

  prepareFakeModuleForSpy(out)

  // this intercepts tinyspy which uses Object.defineProperty to rewrite an object (even a "module")
  return new Proxy({}, {
    ownKeys(_target) {
      return Reflect.ownKeys(out)
    },

    get(_target, p) {
      return out[p]
    },

    getOwnPropertyDescriptor(_target, p) {
      return Reflect.getOwnPropertyDescriptor(out, p)
    },

    defineProperty(_target, property, attributes) {
      // detect original & restore, otherwise this causes recursive call to self
      if ((attributes.get as any)?.[originalSymbol]) {
        out[property] = contents[property]
        return true
      }

      if ('value' in attributes) {
        out[property] = attributes.value
        return true
      }

      if ('get' in attributes) {
        if (!(attributes.set as any)?.[originalSymbol]) {
          // tinyspy passes back the same setter from attributes
          throw new Error(`setter must be original`)
        }
        // TODO: this predisposes a setter, which we could skip (different indirection)
        out[property] = attributes.get!()
        return true
      }

      return false
    },
  }) as T
}

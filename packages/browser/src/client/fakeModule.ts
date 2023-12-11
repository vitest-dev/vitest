// this is just here so Proxy knows we're wrapping a function
function neverFunctionForProxy() {
  throw new Error(`should not get here`)
}

// allows replacing 'function' types on this module: passes through to the 'current value'
function prepareFakeModuleForSpy(fakeModule: any, contents: any) {
  for (const key in contents) {
    if (typeof contents[key] !== 'function') {
      fakeModule[key] = contents[key]
      continue
    }

    // uses Reflect to implement Proxy, but use 'current value' and not the original target
    // this is a Proxy pointing _to_ Reflect, which means it "supports all operations" but on the dynamic target
    const currentValueReflect = new Proxy(Reflect, {
      get(_reflect, reflectKey) {
        return (...args: any[]) => (Reflect as any)[reflectKey](contents[key], ...args.slice(1))
      },
    })
    fakeModule[key] = new Proxy(neverFunctionForProxy, currentValueReflect)
  }
}

// this enables bound-like named imports with the import rewriting scheme
export function buildFakeModule<T extends Record<string | symbol, any>>(module: T): T {
  const fakeModule: Record<string | symbol, any> = { [Symbol.toStringTag]: 'Module' }
  const contents: Record<string | symbol, any> = { ...module }

  prepareFakeModuleForSpy(fakeModule, contents)

  // this intercepts tinyspy which uses Object.defineProperty to rewrite an object (even a "module")
  return new Proxy({}, {
    ownKeys(_target) {
      return Reflect.ownKeys(fakeModule)
    },

    set(_target, _property) {
      return false
    },

    get(_target, property) {
      return fakeModule[property]
    },

    getOwnPropertyDescriptor(_target, p) {
      return Reflect.getOwnPropertyDescriptor(contents, p)
    },

    defineProperty(_target, property, attributes) {
      if (attributes.get || attributes.set)
        throw new Error(`can't defineProperty with get/set on fake module`)

      if ('value' in attributes) {
        contents[property] = attributes.value
        return true
      }

      return false
    },
  }) as T
}

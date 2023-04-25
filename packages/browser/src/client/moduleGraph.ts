type ModuleObject = Readonly<Record<string, unknown>>
type HijackedModuleObject = Record<string, unknown>

const modules = new WeakMap<ModuleObject, HijackedModuleObject>()

const moduleCache = new Map()

// this method receives a module object or "import" promise that it resolves and keeps track of
// and returns a hijacked module object that can be used to mock module exports
export function __vitest_wrap_module__(module: ModuleObject | Promise<ModuleObject>): HijackedModuleObject | Promise<HijackedModuleObject> {
  if (module instanceof Promise) {
    moduleCache.set(module, { promise: module, evaluted: false })
    return module
      .then(m => __vitest_wrap_module__(m))
      .finally(() => moduleCache.delete(module))
  }
  const cached = modules.get(module)
  if (cached)
    return cached
  const hijacked = Object.assign({}, module)
  modules.set(module, hijacked)
  return hijacked as HijackedModuleObject
}

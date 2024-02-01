const moduleCache = new Map()

// this method receives a module object or "import" promise that it resolves and keeps track of
// and returns a hijacked module object that can be used to mock module exports
function wrapModule(module) {
  if (module instanceof Promise) {
    moduleCache.set(module, { promise: module, evaluated: false })
    return module
      // TODO: add a test
      .then(m => '__vi_inject__' in m ? m.__vi_inject__ : m)
      .finally(() => moduleCache.delete(module))
  }
  return '__vi_inject__' in module ? module.__vi_inject__ : module
}

function exportAll(exports, sourceModule) {
  // #1120 when a module exports itself it causes
  // call stack error
  if (exports === sourceModule)
    return

  if (Object(sourceModule) !== sourceModule || Array.isArray(sourceModule))
    return

  for (const key in sourceModule) {
    if (key !== 'default') {
      try {
        Object.defineProperty(exports, key, {
          enumerable: true,
          configurable: true,
          get: () => sourceModule[key],
        })
      }
      catch (_err) { }
    }
  }
}

window.__vi_export_all__ = exportAll

// TODO: allow easier rewriting of import.meta.env
window.__vi_import_meta__ = {
  env: {},
  url: location.href,
}

window.__vi_module_cache__ = moduleCache
window.__vi_wrap_module__ = wrapModule

window.__vi_config__ = { __VITEST_CONFIG__ }
if (window.__vi_config__.testNamePattern)
  window.__vi_config__.testNamePattern = parseRegexp(window.__vi_config__.testNamePattern)
window.__vi_files__ = { __VITEST_FILES__ }

function parseRegexp(input) {
  // Parse input
  const m = input.match(/(\/?)(.+)\1([a-z]*)/i)

  // match nothing
  if (!m)
    return /$^/

  // Invalid flags
  if (m[3] && !/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(m[3]))
    return RegExp(input)

  // Create the regular expression
  return new RegExp(m[2], m[3])
}

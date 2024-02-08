const moduleCache = new Map()

function wrapModule(module) {
  if (module instanceof Promise) {
    moduleCache.set(module, { promise: module, evaluated: false })
    return module
      .then(m => '__vi_inject__' in m ? m.__vi_inject__ : m)
      .finally(() => moduleCache.delete(module))
  }
  return '__vi_inject__' in module ? module.__vi_inject__ : module
}

function exportAll(exports, sourceModule) {
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

window.__vitest_browser_runner__ = {
  exportAll,
  wrapModule,
  moduleCache,
  config: { __VITEST_CONFIG__ },
  files: { __VITEST_FILES__ },
}

const config = __vitest_browser_runner__.config

if (config.testNamePattern)
  config.testNamePattern = parseRegexp(config.testNamePattern)

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

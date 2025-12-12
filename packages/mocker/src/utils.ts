const postfixRE = /[?#].*$/
export function cleanUrl(url: string): string {
  return url.replace(postfixRE, '')
}

export function createManualModuleSource(moduleUrl: string, exports: string[], globalAccessor = '"__vitest_mocker__"'): string {
  const source = `
const __factoryModule__ = globalThis[${globalAccessor}].getFactoryModule("${moduleUrl}");
const module = typeof __factoryModule__.then === 'function' ? {} : __factoryModule__
  `
  const keys = exports
    .map((name) => {
      return `let __${name} = module["${name}"]
export { __${name} as "${name}" }`
    })
    .join('\n')
  let code = `${source}\n${keys}`
  // this prevents recursion
  code += `
if (typeof __factoryModule__.then === 'function') {
  __factoryModule__.then((resolvedModule) => {
    ${exports.map((name) => {
      return `__${name} = resolvedModule["${name}"];`
    }).join('\n')}
  })
}
  `
  return code
}

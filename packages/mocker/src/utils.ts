const postfixRE = /[?#].*$/
export function cleanUrl(url: string): string {
  return url.replace(postfixRE, '')
}

export function createManualModuleSource(moduleUrl: string, exports: string[], globalAccessor = '"__vitest_mocker__"'): string {
  const source = `
const __factoryModule__ = await globalThis[${globalAccessor}].getFactoryModule("${moduleUrl}");
`
  const keys = exports
    .map((name, index) => {
      return `let __${index} = __factoryModule__["${name}"]
export { __${index} as "${name}" }`
    })
    .join('\n')
  let code = `${source}\n${keys}`
  // this prevents recursion
  code += `
if (__factoryModule__.__factoryPromise != null) {
  __factoryModule__.__factoryPromise.then((resolvedModule) => {
    ${exports.map((name, index) => {
      return `__${index} = resolvedModule["${name}"];`
    }).join('\n')}
  })
}
  `
  return code
}

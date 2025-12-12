const postfixRE = /[?#].*$/
export function cleanUrl(url: string): string {
  return url.replace(postfixRE, '')
}

export function createManualModuleSource(moduleUrl: string, exports: string[], globalAccessor = '"__vitest_mocker__"'): string {
  const source = `
const __factoryModule__ = globalThis[${globalAccessor}].getFactoryModule("${moduleUrl}");
const module = typeof __factoryModule__.then === 'function' ? await __factoryModule__ : __factoryModule__
  `
  const keys = exports
    .map((name) => {
      if (name === 'default') {
        return `export default module["default"];`
      }
      return `export const ${name} = module["${name}"];`
    })
    .join('\n')
  return `${source}\n${keys}`
}

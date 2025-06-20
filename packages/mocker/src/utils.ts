const postfixRE = /[?#].*$/
export function cleanUrl(url: string): string {
  return url.replace(postfixRE, '')
}

export function createManualModuleSource(moduleUrl: string, exports: string[], globalAccessor = '"__vitest_mocker__"'): string {
  const source = `const module = globalThis[${globalAccessor}].getFactoryModule("${moduleUrl}");`
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

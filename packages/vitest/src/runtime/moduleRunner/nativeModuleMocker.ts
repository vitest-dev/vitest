import type { SourceMap } from 'magic-string'
import { readFileSync } from 'node:fs'
import module, { createRequire, isBuiltin } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { automockModule, createManualModuleSource } from '@vitest/mocker/transforms'
import { cleanUrl } from '@vitest/utils/helpers'
import { parse } from 'acorn'
import { parse as parseCjsSyntax } from 'cjs-module-lexer'
import { parse as parseModuleSyntax } from 'es-module-lexer'
import { extname } from 'pathe'
import { BareModuleMocker, normalizeModuleId } from './bareModuleMocker'

export class NativeModuleMocker extends BareModuleMocker {
  public wrapDynamicImport<T>(moduleFactory: () => Promise<T>): Promise<T> {
    if (typeof moduleFactory === 'function') {
      const promise = new Promise<T>((resolve, reject) => {
        this.resolveMocks().finally(() => {
          moduleFactory().then(resolve, reject)
        })
      })
      return promise
    }
    return moduleFactory
  }

  public resolveMockedModule(url: string, parentURL: string): module.ResolveFnOutput | undefined {
    const moduleId = normalizeModuleId(url)

    const mockedModule = this.getDependencyMock(moduleId)
    if (!mockedModule) {
      return
    }
    if (mockedModule.type === 'redirect') {
      return {
        url: pathToFileURL(mockedModule.redirect).toString(),
        shortCircuit: true,
      }
    }
    if (mockedModule.type === 'automock' || mockedModule.type === 'autospy') {
      return {
        url: injectQuery(url, parentURL, `mock=${mockedModule.type}`),
        format: 'module',
        shortCircuit: true,
      }
    }
    if (mockedModule.type === 'manual') {
      return {
        url: injectQuery(url, parentURL, 'mock=manual'),
        format: 'module',
        shortCircuit: true,
      }
    }
  }

  public loadAutomock(url: string, result: module.LoadFnOutput): module.LoadFnOutput | undefined {
    const filename = url.startsWith('file://') ? fileURLToPath(url) : url
    const moduleId = cleanUrl(normalizeModuleId(filename))
    let source: string | undefined
    if (isBuiltin(moduleId)) {
      const builtinModule = getBuiltinModule(moduleId)
      const exports = Object.keys(builtinModule)
      source = `
import * as builtinModule from '${url}'

${exports.map((key, index) => {
  return `
    const __val_${index} = builtinModule["${key}"]
    export { __val_${index} as "${key}" }
      `
})}`
    }
    else {
      source = result.source?.toString()
    }

    if (source == null) {
      return
    }

    const mockType = url.includes('mock=automock') ? 'automock' : 'autospy'
    const transformedCode = transformCode(source, moduleId)
    // failed to transform ts file
    if (transformedCode == null) {
      return
    }

    const ms = automockModule(
      transformedCode,
      mockType,
      code => parse(code, {
        sourceType: result.format === 'module' || result.format === 'module-typescript' || result.format === 'typescript'
          ? 'module'
          : 'script',
        ecmaVersion: 'latest',
      }),
    )
    const transformed = ms.toString()
    const map = ms.generateMap({ hires: 'boundary', source: moduleId })
    const code = `${transformed}\n//# sourceMappingURL=${genSourceMapUrl(map)}`

    return {
      format: 'module',
      source: code,
      shortCircuit: true,
    }
  }

  public loadManualMock(url: string, result: module.LoadFnOutput): module.LoadFnOutput | undefined {
    const filename = url.startsWith('file://') ? fileURLToPath(url) : url
    const moduleId = cleanUrl(normalizeModuleId(filename))
    const mockedModule = this.getDependencyMock(moduleId)
    // should not be possible
    if (mockedModule?.type !== 'manual') {
      console.warn(`Vitest detected unregistered manual mock ${moduleId}. This is a bug in Vitest. Please, open a new issue with reproduction.`)
      return result
    }

    if (isBuiltin(moduleId)) {
      const builtinModule = getBuiltinModule(moduleId)
      const exports = Object.keys(builtinModule)
      const manualMockedModule = createManualModuleSource(moduleId, exports)

      return {
        format: 'module',
        source: manualMockedModule,
        shortCircuit: true,
      }
    }
    if (!result.source) {
      return
    }

    const mockedFactoryResult = mockedModule.resolve()
    // the factory is _not_ a promise, we can just take returned exports without
    // parsing the original file
    if (typeof mockedFactoryResult.then !== 'function') {
      const keys = Object.keys(mockedFactoryResult)
      const manualMockedModule = createManualModuleSource(moduleId, keys)

      return {
        format: 'module',
        source: manualMockedModule,
        shortCircuit: true,
      }
    }
    // noop the error handling to avoid unhandled rejections
    // it will still throw an error when importing the module
    mockedFactoryResult.then(() => {}, () => {})

    // since the factory returned an async result, we have to figure out keys synchronosly somehow
    // so we parse the module with es/cjs-module-lexer to find the original exports -- we assume the same ones are returned
    // injecting new keys is not supported (and should not be advised anyway)

    const source = result.source.toString()
    const transformedCode = transformCode(source, moduleId)
    if (transformedCode == null) {
      return
    }

    const format = result.format?.startsWith('module') ? 'module' : 'commonjs'
    const exports = collectModuleExports(moduleId, transformedCode, format)
    const manualMockedModule = createManualModuleSource(moduleId, exports)

    return {
      format: 'module',
      source: manualMockedModule,
      shortCircuit: true,
    }
  }

  public getFactoryModule(id: string): any {
    const registry = this.getMockerRegistry()
    const mock = registry.getById(id)
    if (!mock || mock.type !== 'manual') {
      throw new Error(`Mock ${id} wasn't registered. This is probably a Vitest error. Please, open a new issue with reproduction.`)
    }
    return mock.resolve()
  }
}

const replacePercentageRE = /%/g
function injectQuery(url: string, importer: string, queryToInject: string): string {
  // encode percents for consistent behavior with pathToFileURL
  // see #2614 for details
  const resolvedUrl = new URL(
    url.replace(replacePercentageRE, '%25'),
    importer,
  )
  const { search, hash } = resolvedUrl
  const pathname = cleanUrl(url)
  return `${pathname}?${queryToInject}${search ? `&${search.slice(1)}` : ''}${
    hash ?? ''
  }`
}

let __require: NodeJS.Require | undefined
function getBuiltinModule(moduleId: string) {
  __require ??= module.createRequire(import.meta.url)
  return __require(moduleId)
}

function genSourceMapUrl(map: SourceMap | string): string {
  if (typeof map !== 'string') {
    map = JSON.stringify(map)
  }
  return `data:application/json;base64,${Buffer.from(map).toString('base64')}`
}

function transformCode(code: string, filename: string): string {
  const ext = extname(filename)
  const isTs = ext === '.ts' || ext === '.cts' || ext === '.mts'
  if (!isTs) {
    return code
  }
  if (!module.stripTypeScriptTypes) {
    throw new Error(`Cannot parse '${filename}' because "module.stripTypeScriptTypes" is not supported. Module mocking requires Node.js 22.15 or higher.`)
  }
  return module.stripTypeScriptTypes(filename)
}

// TODO: caching for better perf
function collectModuleExports(
  filename: string,
  code: string,
  format: 'module' | 'commonjs',
  exports: string[] = [],
): string[] {
  if (format === 'module') {
    const [imports_, exports_] = parseModuleSyntax(code, filename)
    exports.push(...exports_.map(p => p.n))
    imports_.forEach(({ ss: start, se: end, n: name }) => {
      const substring = code.substring(start, end).replace(/ +/g, ' ')
      if (name && substring.startsWith('export *') && !substring.startsWith('export * as')) {
        tryParseModule(name)
      }
    })
  }
  else {
    const { exports: exports_, reexports } = parseCjsSyntax(code, filename)
    exports.push(...exports_)
    reexports.forEach((name) => {
      tryParseModule(name)
    })
  }

  function tryParseModule(name: string) {
    try {
      parseModule(name)
    }
    catch (error) {
      console.warn(`[module mocking] Failed to parse '${name}' imported from ${filename}:`, error)
    }
  }

  let __require: NodeJS.Require | undefined
  function getModuleRequire() {
    return (__require ??= createRequire(filename))
  }

  function parseModule(name: string) {
    if (isBuiltin(name)) {
      const builtinModule = getBuiltinModule(name)
      exports.push(...Object.keys(builtinModule), 'default')
      return
    }

    const resolvedModuleUrl = format === 'module'
      ? import.meta.resolve(name, pathToFileURL(filename))
      : getModuleRequire().resolve(name)
    const resolveModulePath = format === 'commonjs'
      ? resolvedModuleUrl
      : fileURLToPath(resolvedModuleUrl)
    const fileContent = readFileSync(resolveModulePath, 'utf-8')
    const ext = extname(resolveModulePath)
    const code = transformCode(fileContent, resolveModulePath)
    if (code == null) {
      return
    }

    let resolvedModuleFormat: 'module' | 'commonjs' | undefined
    if (ext === '.cjs' || ext === '.cts') {
      resolvedModuleFormat = 'commonjs'
    }
    else if (ext === '.mjs' || ext === '.mts') {
      resolvedModuleFormat = 'module'
    }
    else if (ext === '.js' || ext === '.ts') {
      // TODO: node has a flag to switch the behavior
      // module.findPackageJSON() exists since 22.14, and sync hooks require Node 22.15
      const pkgJsonPath = module.findPackageJSON(resolvedModuleUrl)
      const pkgJson = pkgJsonPath ? JSON.parse(readFileSync(pkgJsonPath, 'utf-8')) : {}
      if (pkgJson?.type === 'module') {
        resolvedModuleFormat = 'module'
      }
      else {
        resolvedModuleFormat = 'commonjs'
      }
    }
    else if (ext === '.json') {
      exports.push('default')
    }
    else {
      // can't do wasm, for example
      console.warn(`Cannot process '${resolvedModuleFormat}' imported from ${filename} because of unknown file extension: ${ext}.`)
    }
    if (resolvedModuleFormat) {
      collectModuleExports(resolveModulePath, code, resolvedModuleFormat, exports)
    }
  }

  return Array.from(new Set(exports))
}

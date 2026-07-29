import type { DeferPromise } from '@vitest/utils/helpers'
import type { SourceMap } from 'magic-string'
import module, { isBuiltin } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  automockModule,
  collectModuleExports,
  createManualModuleSource,
} from '@vitest/mocker/transforms'
import { cleanUrl, createDefer } from '@vitest/utils/helpers'
import { parse } from 'acorn'
import { isAbsolute } from 'pathe'
import { toBuiltin } from '../../utils/modules'
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
    // don't mock modules inside of packages because there is
    // a high chance that it uses `require` which is not mockable
    // because we use top-level await in "manual" mocks.
    // for the sake of consistency we don't support mocking anything at all
    if (parentURL.includes('/node_modules/')) {
      return
    }

    const filename = url.startsWith('file://') ? fileURLToPath(url) : url
    const moduleId = normalizeModuleId(filename)

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
        shortCircuit: true,
      }
    }
    if (mockedModule.type === 'manual') {
      return {
        url: injectQuery(url, parentURL, 'mock=manual'),
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
import * as builtinModule from '${toBuiltin(moduleId)}?mock=actual'

${exports.map((key, index) => {
  return `
const __${index} = builtinModule["${key}"]
export { __${index} as "${key}" }
`
}).join('')}`
    }
    else {
      source = result.source?.toString()
    }

    if (source == null) {
      return
    }

    const mockType = url.includes('mock=automock') ? 'automock' : 'autospy'
    const transformedCode = transformCode(source, result.format || 'module', moduleId)

    try {
      const ms = automockModule(
        transformedCode,
        mockType,
        code => parse(code, {
          sourceType: 'module',
          ecmaVersion: 'latest',
        }),
        { id: moduleId },
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
    catch (cause) {
      throw new Error(`Cannot automock '${url}' because it failed to parse.`, { cause })
    }
  }

  public loadManualMock(url: string, result: module.LoadFnOutput): module.LoadFnOutput | undefined {
    const filename = url.startsWith('file://') ? fileURLToPath(url) : url
    const moduleId = cleanUrl(normalizeModuleId(filename))
    const mockedModule = this.getDependencyMock(moduleId)
    // should not be possible
    if (mockedModule?.type !== 'manual') {
      console.warn(`Vitest detected unregistered manual mock ${moduleId}. This is a bug in Vitest. Please, open a new issue with reproduction.`)
      return
    }

    if (isBuiltin(moduleId)) {
      const builtinModule = getBuiltinModule(toBuiltin(moduleId))
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

    const source = result.source.toString()
    const transformedCode = transformCode(source, result.format || 'module', moduleId)
    if (transformedCode == null) {
      return
    }

    const format = result.format?.startsWith('module') ? 'module' : 'commonjs'
    try {
      // we parse the module with es/cjs-module-lexer to find the original exports -- we assume the same ones are returned from the factory
      // injecting new keys is not supported (and should not be advised anyway)
      const exports = collectModuleExports(moduleId, transformedCode, format)
      const manualMockedModule = createManualModuleSource(moduleId, exports)

      return {
        format: 'module',
        source: manualMockedModule,
        shortCircuit: true,
      }
    }
    catch (cause) {
      throw new Error(`Failed to mock '${url}'. See the cause for more information.`, { cause })
    }
  }

  private processedModules = new Map<string, number>()

  public checkCircularManualMock(url: string): void {
    const filename = url.startsWith('file://') ? fileURLToPath(url) : url
    const id = cleanUrl(normalizeModuleId(filename))
    this.processedModules.set(id, (this.processedModules.get(id) ?? 0) + 1)
    // the module is mocked and requested a second time, let's resolve
    // the factory function that will redefine the exports later
    if (this.originalModulePromises.has(id)) {
      const factoryPromise = this.factoryPromises.get(id)
      this.originalModulePromises.get(id)?.resolve({ __factoryPromise: factoryPromise })
    }
  }

  private originalModulePromises = new Map<string, DeferPromise<any>>()
  private factoryPromises = new Map<string, Promise<any>>()

  // potential performance improvement:
  // store by URL, not ids, no need to call url.*to* methods and normalizeModuleId
  public getFactoryModule(id: string): any {
    const registry = this.getMockerRegistry()
    const mock = registry.getById(id)
    if (!mock || mock.type !== 'manual') {
      throw new Error(`Mock ${id} wasn't registered. This is probably a Vitest error. Please, open a new issue with reproduction.`)
    }

    const mockResult = mock.resolve()
    if (mockResult instanceof Promise) {
      // to avoid circular dependency, we resolve this function as {__factoryPromise} in `checkCircularManualMock`
      // when it's requested the second time. then the exports are exposed as `undefined`,
      // but later redefined when the promise is actually resolved
      const promise = createDefer()
      promise.finally(() => {
        this.originalModulePromises.delete(id)
      })
      mockResult.then(promise.resolve, promise.reject).finally(() => {
        this.factoryPromises.delete(id)
      })
      this.factoryPromises.set(id, mockResult)
      this.originalModulePromises.set(id, promise)
      // Node.js on windows processes all the files first, and then runs them
      // unlike Node.js logic on Mac and Unix where it also runs the code while evaluating
      // So on Linux/Mac this `if` won't be hit because `checkCircularManualMock` will resolve it
      // And on Windows, the `checkCircularManualMock` will never have `originalModulePromises`
      // because `getFactoryModule` is not called until the evaluation phase
      // But if we track how many times the module was transformed,
      // we can deduce when to return `__factoryPromise` to support circular modules
      if ((this.processedModules.get(id) ?? 0) > 1) {
        this.processedModules.set(id, (this.processedModules.get(id) ?? 1) - 1)
        promise.resolve({ __factoryPromise: mockResult })
      }
      return promise
    }

    return mockResult
  }

  public importActual<T>(rawId: string, importer: string): Promise<T> {
    const resolvedId = import.meta.resolve(rawId, pathToFileURL(importer).toString())
    const url = new URL(resolvedId)
    url.searchParams.set('mock', 'actual')
    return import(url.toString())
  }

  public importMock<T>(rawId: string, importer: string): Promise<T> {
    const resolvedId = import.meta.resolve(rawId, pathToFileURL(importer).toString())
    // file is already mocked
    if (resolvedId.includes('mock=')) {
      return import(resolvedId)
    }

    const filename = fileURLToPath(resolvedId)
    const external = !isAbsolute(filename) || this.isModuleDirectory(resolvedId)
      ? normalizeModuleId(rawId)
      : null
    // file is not mocked, automock or redirect it
    const redirect = this.findMockRedirect(filename, external)
    if (redirect) {
      return import(pathToFileURL(redirect).toString())
    }

    const url = new URL(resolvedId)
    url.searchParams.set('mock', 'automock')
    return import(url.toString())
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
  return __require(`${moduleId}?mock=actual`)
}

function genSourceMapUrl(map: SourceMap | string): string {
  if (typeof map !== 'string') {
    map = JSON.stringify(map)
  }
  return `data:application/json;base64,${Buffer.from(map).toString('base64')}`
}

function transformCode(code: string, format: string, filename: string) {
  if (format.includes('typescript')) {
    if (!module.stripTypeScriptTypes) {
      throw new Error(`Cannot parse '${filename}' because "module.stripTypeScriptTypes" is not supported. Module mocking requires Node.js 22.15 or higher. This is NOT a bug of Vitest.`)
    }
    return module.stripTypeScriptTypes(code)
  }
  return code
}

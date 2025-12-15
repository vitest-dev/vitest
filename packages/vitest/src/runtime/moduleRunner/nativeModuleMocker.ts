import type { DeferPromise } from '@vitest/utils/helpers'
import type { SourceMap } from 'magic-string'
import module, { isBuiltin } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  automockModule,
  collectModuleExports,
  createManualModuleSource,
  transformCode,
} from '@vitest/mocker/transforms'
import { cleanUrl, createDefer } from '@vitest/utils/helpers'
import { parse } from 'acorn'
import { isAbsolute } from 'pathe'
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
const __${index} = builtinModule["${key}"]
export { __${index} as "${key}" }`.trim()
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

  public checkCircularManualMock(url: string): void {
    const filename = url.startsWith('file://') ? fileURLToPath(url) : url
    const id = cleanUrl(normalizeModuleId(filename))
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
      // to avoid circular dependency, we resolve this function as {__factoryPromise}
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
  return __require(moduleId)
}

function genSourceMapUrl(map: SourceMap | string): string {
  if (typeof map !== 'string') {
    map = JSON.stringify(map)
  }
  return `data:application/json;base64,${Buffer.from(map).toString('base64')}`
}

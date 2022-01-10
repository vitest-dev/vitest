import { builtinModules, createRequire } from 'module'
import { fileURLToPath, pathToFileURL } from 'url'
import vm from 'vm'
import { dirname, resolve } from 'pathe'
import type { FetchFunction, ModuleCache } from '../types'
import { normalizeId, slash, toFilePath } from '../utils'
import type { SuiteMocks } from './mocker'
import { createMocker } from './mocker'

export interface ViteNodeOptions {
  root: string
  base?: string
  fetch: FetchFunction
  moduleCache: Map<string, ModuleCache>
  depsInline: (string | RegExp)[]
  depsExternal: (string | RegExp)[]
  fallbackCJS: boolean
  interpretDefault: boolean
  requestStubs?: Record<string, any>
}

export interface ExecuteOptions extends ViteNodeOptions {
  files: string[]
  mockMap: SuiteMocks
}

function hasNestedDefault(target: any) {
  return '__esModule' in target && target.__esModule && 'default' in target.default
}

function proxyMethod(name: 'get' | 'set' | 'has' | 'deleteProperty', tryDefault: boolean) {
  return function(target: any, key: string | symbol, ...args: [any?, any?]) {
    const result = Reflect[name](target, key, ...args)
    if (typeof target.default !== 'object')
      return result
    if ((tryDefault && key === 'default') || typeof result === 'undefined')
      return Reflect[name](target.default, key, ...args)
    return result
  }
}

export async function interpretedImport(path: string, interpretDefault: boolean) {
  const mod = await import(path)

  if (interpretDefault && 'default' in mod) {
    const tryDefault = hasNestedDefault(mod)
    return new Proxy(mod, {
      get: proxyMethod('get', tryDefault),
      set: proxyMethod('set', tryDefault),
      has: proxyMethod('has', tryDefault),
      deleteProperty: proxyMethod('deleteProperty', tryDefault),
    })
  }

  return mod
}

function exportAll(exports: any, sourceModule: any) {
  // eslint-disable-next-line no-restricted-syntax
  for (const key in sourceModule) {
    if (key !== 'default') {
      try {
        Object.defineProperty(exports, key, {
          enumerable: true,
          configurable: true,
          get() { return sourceModule[key] },
        })
      }
      catch (_err) { }
    }
  }
}

export async function executeInViteNode(options: ExecuteOptions) {
  const runner = new VitestRunner(options)

  const result: any[] = []
  for (const file of options.files)
    result.push(await runner.run(file))

  return result
}

export class ViteNodeRunner {
  root: string

  externalCache: Map<string, string | Promise<false | string>>
  moduleCache: Map<string, ModuleCache>

  constructor(public options: ViteNodeOptions) {
    this.root = options.root || process.cwd()

    this.moduleCache = options.moduleCache || new Map()
    this.externalCache = new Map<string, string | Promise<false | string>>()
    builtinModules.forEach(m => this.externalCache.set(m, m))
  }

  async run(file: string) {
    return await this.cachedRequest(`/@fs/${slash(resolve(file))}`, [])
  }

  async cachedRequest(rawId: string, callstack: string[]) {
    const id = normalizeId(rawId, this.options.base)
    const fsPath = toFilePath(id, this.root)

    if (this.moduleCache.get(fsPath)?.promise)
      return this.moduleCache.get(fsPath)?.promise

    const promise = this.directRequest(id, fsPath, callstack)
    this.setCache(fsPath, { promise })

    return await promise
  }

  async directRequest(id: string, fsPath: string, callstack: string[]) {
    callstack = [...callstack, id]
    const request = async(dep: string) => {
      if (callstack.includes(dep)) {
        const cacheKey = toFilePath(dep, this.root)
        if (!this.moduleCache.get(cacheKey)?.exports)
          throw new Error(`Circular dependency detected\nStack:\n${[...callstack, dep].reverse().map(p => `- ${p}`).join('\n')}`)
        return this.moduleCache.get(cacheKey)!.exports
      }
      return this.cachedRequest(dep, callstack)
    }

    if (this.options.requestStubs && id in this.options.requestStubs)
      return this.options.requestStubs[id]

    const { code: transformed, externalize } = await this.options.fetch(id)
    if (externalize) {
      const mod = await interpretedImport(externalize, this.options.interpretDefault)
      this.setCache(fsPath, { exports: mod })
      return mod
    }

    if (transformed == null)
      throw new Error(`failed to load ${id}`)

    // disambiguate the `<UNIT>:/` on windows: see nodejs/node#31710
    const url = pathToFileURL(fsPath).href
    const exports: any = {}

    this.setCache(fsPath, { code: transformed, exports })

    const __filename = fileURLToPath(url)
    const moduleProxy = {
      set exports(value) {
        exportAll(exports, value)
        exports.default = value
      },
      get exports() {
        return exports.default
      },
    }

    const context = this.prepareContext({
      // esm transformed by Vite
      __vite_ssr_import__: request,
      __vite_ssr_dynamic_import__: request,
      __vite_ssr_exports__: exports,
      __vite_ssr_exportAll__: (obj: any) => exportAll(exports, obj),
      __vite_ssr_import_meta__: { url },

      // cjs compact
      require: createRequire(url),
      exports,
      module: moduleProxy,
      __filename,
      __dirname: dirname(__filename),
    })

    const fn = vm.runInThisContext(`async (${Object.keys(context).join(',')})=>{{${transformed}\n}}`, {
      filename: fsPath,
      lineOffset: 0,
    })
    await fn(...Object.values(context))

    return exports
  }

  prepareContext(context: Record<string, any>) {
    return context
  }

  setCache(id: string, mod: Partial<ModuleCache>) {
    if (!this.moduleCache.has(id))
      this.moduleCache.set(id, mod)
    else
      Object.assign(this.moduleCache.get(id), mod)
  }
}

export class VitestRunner extends ViteNodeRunner {
  mocker: ReturnType<typeof createMocker>

  constructor(public options: ExecuteOptions) {
    super(options)

    options.requestStubs = options.requestStubs || {
      '/@vite/client': {
        injectQuery: (id: string) => id,
        createHotContext() {
          return {
            accept: () => {},
            prune: () => {},
          }
        },
        updateStyle() {},
      },
    }

    this.mocker = createMocker(this.root, options.mockMap)
  }

  prepareContext(context: Record<string, any>) {
    const suite = this.mocker.getSuiteFilepath()
    const mockMap = this.options.mockMap
    const request = context.__vite_ssr_import__

    const callFunctionMock = async(dep: string, mock: () => any) => {
      const name = `${dep}__mock`
      const cached = this.moduleCache.get(name)?.exports
      if (cached)
        return cached
      const exports = await mock()
      this.setCache(name, { exports })
      return exports
    }

    const requestWithMock = async(dep: string) => {
      const mocks = mockMap[suite || ''] || {}
      const mock = mocks[this.mocker.resolveDependency(dep)]
      if (mock === null) {
        const mockedKey = `${dep}__mock`
        const cache = this.moduleCache.get(mockedKey)
        if (cache?.exports)
          return cache.exports
        const cacheKey = toFilePath(dep, this.root)
        const mod = this.moduleCache.get(cacheKey)?.exports || await request(dep)
        const exports = this.mocker.mockObject(mod)
        this.setCache(mockedKey, { exports })
        return exports
      }
      if (typeof mock === 'function')
        return callFunctionMock(dep, mock)
      if (typeof mock === 'string')
        dep = mock
      return request(dep)
    }
    const importActual = (path: string, nmName: string) => {
      return request(this.mocker.getActualPath(path, nmName))
    }
    const importMock = async(path: string, nmName: string): Promise<any> => {
      if (!suite)
        throw new Error('You can import mock only inside of a running test')

      const mock = (mockMap[suite] || {})[path] || this.mocker.resolveMockPath(path, this.root, nmName)
      if (mock === null) {
        const fsPath = this.mocker.getActualPath(path, nmName)
        const mod = await request(fsPath)
        return this.mocker.mockObject(mod)
      }
      if (typeof mock === 'function')
        return callFunctionMock(path, mock)
      return requestWithMock(mock)
    }

    return Object.assign(context, {
      __vite_ssr_import__: requestWithMock,
      __vite_ssr_dynamic_import__: requestWithMock,

      // vitest.mock API
      __vitest__mock__: this.mocker.mockPath,
      __vitest__unmock__: this.mocker.unmockPath,
      __vitest__importActual__: importActual,
      __vitest__importMock__: importMock,
      // spies from 'jest-mock' are different inside suites and execute,
      // so wee need to call this twice - inside suite and here
      __vitest__clearMocks__: this.mocker.clearMocks,
    })
  }
}

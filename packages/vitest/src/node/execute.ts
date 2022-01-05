import { builtinModules, createRequire } from 'module'
import { fileURLToPath, pathToFileURL } from 'url'
import vm from 'vm'
import { dirname, resolve } from 'pathe'
import type { ModuleCache, ResolvedConfig } from '../types'
import { slash, toFilePath } from '../utils'
import { shouldExternalize } from '../utils/externalize'
import type { SuiteMocks } from './mocker'
import { createMocker } from './mocker'

export type FetchFunction = (id: string) => Promise<string | undefined>

export interface ExecuteOptions extends Pick<ResolvedConfig, 'depsInline' | 'depsExternal' | 'fallbackCJS' | 'base'> {
  root: string
  files: string[]
  fetch: FetchFunction
  interpretDefault: boolean
  moduleCache: Map<string, ModuleCache>
  mockMap: SuiteMocks
}

export const stubRequests: Record<string, any> = {
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

function hasNestedDefault(target: any) {
  return '__esModule' in target && target.__esModule && 'default' in target.default
}

function proxyMethod(name: 'get' | 'set' | 'has' | 'deleteProperty', isNested: boolean) {
  return function(target: any, key: string | symbol, ...args: [any?, any?]) {
    const result = Reflect[name](target, key, ...args)
    if ((isNested && key === 'default') || !result)
      return Reflect[name](target.default, key, ...args)
    return result
  }
}

export async function interpretedImport(path: string, interpretDefault: boolean) {
  const mod = await import(path)

  if (interpretDefault && 'default' in mod) {
    const isNested = hasNestedDefault(mod)
    return new Proxy(mod, {
      get: proxyMethod('get', isNested),
      set: proxyMethod('set', isNested),
      has: proxyMethod('has', isNested),
      deleteProperty: proxyMethod('deleteProperty', isNested),
    })
  }

  return mod
}

export async function executeInViteNode(options: ExecuteOptions) {
  const { moduleCache, root, files, fetch, mockMap, base } = options

  const externalCache = new Map<string, false | string>()
  builtinModules.forEach(m => externalCache.set(m, m))

  const {
    getActualPath,
    getSuiteFilepath,
    mockObject,
    mockPath,
    clearMocks,
    unmockPath,
    resolveMockPath,
    resolveDependency,
  } = createMocker(root, mockMap)

  const result = []
  for (const file of files)
    result.push(await cachedRequest(`/@fs/${slash(resolve(file))}`, []))
  return result

  async function callFunctionMock(dep: string, mock: () => any) {
    const name = `${dep}__mock`
    const cached = moduleCache.get(name)?.exports
    if (cached)
      return cached
    const exports = await mock()
    setCache(name, { exports })
    return exports
  }

  async function directRequest(id: string, fsPath: string, callstack: string[]) {
    callstack = [...callstack, id]
    const suite = getSuiteFilepath()
    const request = async(dep: string, canMock = true) => {
      if (canMock) {
        const mocks = mockMap[suite || ''] || {}
        const mock = mocks[resolveDependency(dep)]
        if (typeof mock === 'function')
          return callFunctionMock(dep, mock)
        if (typeof mock === 'string')
          dep = mock
      }
      if (callstack.includes(dep)) {
        const cacheKey = toFilePath(dep, root)
        if (!moduleCache.get(cacheKey)?.exports)
          throw new Error(`Circular dependency detected\nStack:\n${[...callstack, dep].reverse().map(p => `- ${p}`).join('\n')}`)
        return moduleCache.get(cacheKey)!.exports
      }
      return cachedRequest(dep, callstack)
    }

    if (id in stubRequests)
      return stubRequests[id]

    const transformed = await fetch(id)
    if (transformed == null)
      throw new Error(`failed to load ${id}`)

    // disambiguate the `<UNIT>:/` on windows: see nodejs/node#31710
    const url = pathToFileURL(fsPath).href
    const exports: any = {}

    setCache(fsPath, { code: transformed, exports })

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

    const importActual = (path: string, nmName: string) => {
      return request(getActualPath(path, nmName), false)
    }

    const importMock = async(path: string, nmName: string) => {
      if (!suite)
        throw new Error('You can import mock only inside of a running test')

      const mock = (mockMap[suite] || {})[path] || resolveMockPath(path, root, nmName)
      if (mock === null) {
        const fsPath = getActualPath(path, nmName)
        const exports = mockObject(await request(fsPath, false))
        setCache(fsPath, { exports })
        return exports
      }
      if (typeof mock === 'function')
        return callFunctionMock(path, mock)
      return request(mock, true)
    }

    const context = {
      // esm transformed by Vite
      __vite_ssr_import__: request,
      __vite_ssr_dynamic_import__: request,
      __vite_ssr_exports__: exports,
      __vite_ssr_exportAll__: (obj: any) => exportAll(exports, obj),
      __vite_ssr_import_meta__: { url },

      // vitest.mock API
      __vitest__mock__: mockPath,
      __vitest__unmock__: unmockPath,
      __vitest__importActual__: importActual,
      __vitest__importMock__: importMock,
      // spies from 'jest-mock' are different inside suites and execute,
      // so wee need to call this twice - inside suite and here
      __vitest__clearMocks__: clearMocks,

      // cjs compact
      require: createRequire(url),
      exports,
      module: moduleProxy,
      __filename,
      __dirname: dirname(__filename),
    }

    const fn = vm.runInThisContext(`async (${Object.keys(context).join(',')})=>{{${transformed}\n}}`, {
      filename: fsPath,
      lineOffset: 0,
    })
    await fn(...Object.values(context))

    const mocks = suite ? mockMap[suite] : null
    if (mocks) {
      if (mocks[id] === null)
        exportAll(exports, mockObject(exports))
    }

    return exports
  }

  function setCache(id: string, mod: Partial<ModuleCache>) {
    if (!moduleCache.has(id))
      moduleCache.set(id, mod)
    else
      Object.assign(moduleCache.get(id), mod)
  }

  async function cachedRequest(rawId: string, callstack: string[]) {
    const id = normalizeId(rawId, base)

    if (externalCache.get(id))
      return interpretedImport(patchWindowsImportPath(id), options.interpretDefault)

    const fsPath = toFilePath(id, root)
    const importPath = patchWindowsImportPath(fsPath)

    if (!externalCache.has(importPath))
      externalCache.set(importPath, await shouldExternalize(importPath, options))

    const externalId = externalCache.get(importPath)
    if (externalId)
      return interpretedImport(externalId, options.interpretDefault)

    if (moduleCache.get(fsPath)?.promise)
      return moduleCache.get(fsPath)?.promise
    const promise = directRequest(id, fsPath, callstack)
    setCache(fsPath, { promise })
    return await promise
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
}

export function normalizeId(id: string, base?: string): string {
  if (base && id.startsWith(base))
    id = `/${id.slice(base.length)}`

  return id
    .replace(/^\/@id\/__x00__/, '\0') // virtual modules start with `\0`
    .replace(/^\/@id\//, '')
    .replace(/^__vite-browser-external:/, '')
    .replace(/^node:/, '')
    .replace(/[?&]v=\w+/, '?') // remove ?v= query
    .replace(/\?$/, '') // remove end query mark
}

function patchWindowsImportPath(path: string) {
  if (path.match(/^\w:\\/))
    return `file:///${slash(path)}`
  else if (path.match(/^\w:\//))
    return `file:///${path}`
  else
    return path
}

import { builtinModules, createRequire } from 'module'
import { fileURLToPath, pathToFileURL } from 'url'
import vm from 'vm'
import { dirname, resolve } from 'pathe'
import { isValidNodeImport } from 'mlly'
import type { ModuleCache } from '../types'
import { slash } from '../utils'
import type { SuiteMocks } from './mocker'
import { createMocker } from './mocker'

export type FetchFunction = (id: string) => Promise<string | undefined>

export interface ExecuteOptions {
  root: string
  files: string[]
  fetch: FetchFunction
  interpretDefault: boolean
  inline: (string | RegExp)[]
  external: (string | RegExp)[]
  moduleCache: Map<string, ModuleCache>
  mockMap: SuiteMocks
}

const defaultInline = [
  'vitest/dist',
  /virtual:/,
  /\.ts$/,
  /\/esm\/.*\.js$/,
  /\.(es|esm|esm-browser|esm-bundler|es6).js$/,
]
const depsExternal = [
  /\.cjs.js$/,
  /\.mjs$/,
]

const isWindows = process.platform === 'win32'

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

export async function interpretedImport(path: string, interpretDefault: boolean) {
  const mod = await import(path)

  if (interpretDefault && 'default' in mod) {
    return new Proxy(mod, {
      get(target, key, receiver) {
        return Reflect.get(target, key, receiver) || Reflect.get(target.default, key, receiver)
      },
      set(target, key, value, receiver) {
        return Reflect.set(target, key, value, receiver) || Reflect.set(target.default, key, value, receiver)
      },
      has(target, key) {
        return Reflect.has(target, key) || Reflect.has(target.default, key)
      },
      deleteProperty(target, key) {
        return Reflect.deleteProperty(target, key) || Reflect.deleteProperty(target.default, key)
      },
    })
  }

  return mod
}

export async function executeInViteNode(options: ExecuteOptions) {
  const { moduleCache, root, files, fetch, mockMap } = options

  const externalCache = new Map<string, boolean>()
  builtinModules.forEach(m => externalCache.set(m, true))

  const {
    getActualPath,
    getSuiteFilepath,
    mockObject,
    mockPath,
    clearMocks,
    unmockPath,
    resolveMockPath,
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
        const mock = mocks[dep]
        if (typeof mock === 'function')
          return callFunctionMock(dep, mock)
        if (typeof mock === 'string')
          dep = mock
        if (typeof mock === 'object')
          return mock
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

    const mockFile = async(path: string, nmName: string, factory?: () => any) => {
      if (!suite)
        throw new Error('You can import mock only inside of a running test')

      if (!factory) {
        const code = await importMock(path, nmName)
        mockPath(path, nmName, code)
      }
      else {
        mockPath(path, nmName, factory)
      }
    }

    const context = {
      // esm transformed by Vite
      __vite_ssr_import__: request,
      __vite_ssr_dynamic_import__: request,
      __vite_ssr_exports__: exports,
      __vite_ssr_exportAll__: (obj: any) => exportAll(exports, obj),
      __vite_ssr_import_meta__: { url },

      // vitest.mock API
      __vitest__mock__: mockFile,
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



    return exports
  }

  function setCache(id: string, mod: Partial<ModuleCache>) {
    if (!moduleCache.has(id))
      moduleCache.set(id, mod)
    else
      Object.assign(moduleCache.get(id), mod)
  }

  async function cachedRequest(rawId: string, callstack: string[]) {
    const id = normalizeId(rawId)

    if (externalCache.get(id))
      return interpretedImport(patchWindowsImportPath(id), options.interpretDefault)

    const fsPath = toFilePath(id, root)
    const importPath = patchWindowsImportPath(fsPath)

    if (!externalCache.has(importPath))
      externalCache.set(importPath, await shouldExternalize(importPath, options))

    if (externalCache.get(importPath))
      return interpretedImport(importPath, options.interpretDefault)

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

export function normalizeId(id: string): string {
  return id
    .replace(/^\/@id\/__x00__/, '\0') // virtual modules start with `\0`
    .replace(/^\/@id\//, '')
    .replace(/^__vite-browser-external:/, '')
    .replace(/^node:/, '')
    .replace(/[?&]v=\w+/, '?') // remove ?v= query
    .replace(/\?$/, '') // remove end query mark
}

export async function shouldExternalize(id: string, config: Pick<ExecuteOptions, 'inline' | 'external'>) {
  if (matchExternalizePattern(id, config.inline))
    return false
  if (matchExternalizePattern(id, config.external))
    return true

  if (matchExternalizePattern(id, depsExternal))
    return true
  if (matchExternalizePattern(id, defaultInline))
    return false

  return id.includes('/node_modules/') && await isValidNodeImport(id)
}

export function toFilePath(id: string, root: string): string {
  let absolute = slash(id).startsWith('/@fs/')
    ? id.slice(4)
    : id.startsWith(dirname(root))
      ? id
      : id.startsWith('/')
        ? slash(resolve(root, id.slice(1)))
        : id

  if (absolute.startsWith('//'))
    absolute = absolute.slice(1)

  // disambiguate the `<UNIT>:/` on windows: see nodejs/node#31710
  return isWindows && absolute.startsWith('/')
    ? fileURLToPath(pathToFileURL(absolute.slice(1)).href)
    : absolute
}

function matchExternalizePattern(id: string, patterns: (string | RegExp)[]) {
  for (const ex of patterns) {
    if (typeof ex === 'string') {
      if (id.includes(`/node_modules/${ex}/`))
        return true
    }
    else {
      if (ex.test(id))
        return true
    }
  }
  return false
}

function patchWindowsImportPath(path: string) {
  if (path.match(/^\w:\\/))
    return `file:///${slash(path)}`
  else if (path.match(/^\w:\//))
    return `file:///${path}`
  else
    return path
}

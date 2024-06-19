import { existsSync, readdirSync } from 'node:fs'
import vm from 'node:vm'
import { basename, dirname, extname, isAbsolute, join, resolve } from 'pathe'
import { highlight } from '@vitest/utils'
import { isNodeBuiltin } from 'vite-node/utils'
import { mockObject } from '@vitest/mocker/implementation'
import { distDir } from '../paths'
import type { MockFactory, PendingSuiteMock } from '../types/mocker'
import type { VitestExecutor } from './execute'

const spyModulePath = resolve(distDir, 'spy.js')

type Key = string | symbol

interface MockContext {
  /**
   * When mocking with a factory, this refers to the module that imported the mock.
   */
  callstack: null | string[]
}

export class VitestMocker {
  static pendingIds: PendingSuiteMock[] = []
  private spyModule?: typeof import('@vitest/spy')
  private resolveCache = new Map<string, Record<string, string>>()
  private primitives: {
    Object: typeof Object
    Function: typeof Function
    RegExp: typeof RegExp
    Array: typeof Array
    Map: typeof Map
    Error: typeof Error
    Symbol: typeof Symbol
  }

  private filterPublicKeys: (symbol | string)[]

  private mockContext: MockContext = {
    callstack: null,
  }

  constructor(public executor: VitestExecutor) {
    const context = this.executor.options.context
    if (context) {
      this.primitives = vm.runInContext(
        '({ Object, Error, Function, RegExp, Symbol, Array, Map })',
        context,
      )
    }
    else {
      this.primitives = {
        Object,
        Error,
        Function,
        RegExp,
        Symbol: globalThis.Symbol,
        Array,
        Map,
      }
    }

    const Symbol = this.primitives.Symbol

    this.filterPublicKeys = [
      '__esModule',
      Symbol.asyncIterator,
      Symbol.hasInstance,
      Symbol.isConcatSpreadable,
      Symbol.iterator,
      Symbol.match,
      Symbol.matchAll,
      Symbol.replace,
      Symbol.search,
      Symbol.split,
      Symbol.species,
      Symbol.toPrimitive,
      Symbol.toStringTag,
      Symbol.unscopables,
    ]
  }

  private get root() {
    return this.executor.options.root
  }

  private get mockMap() {
    return this.executor.options.mockMap
  }

  private get moduleCache() {
    return this.executor.moduleCache
  }

  private get moduleDirectories() {
    return this.executor.options.moduleDirectories || []
  }

  public async initializeSpyModule() {
    this.spyModule = await this.executor.executeId(spyModulePath)
  }

  private deleteCachedItem(id: string) {
    const mockId = this.getMockPath(id)
    if (this.moduleCache.has(mockId)) {
      this.moduleCache.delete(mockId)
    }
  }

  private isModuleDirectory(path: string) {
    return this.moduleDirectories.some(dir => path.includes(dir))
  }

  public getSuiteFilepath(): string {
    return this.executor.state.filepath || 'global'
  }

  private createError(message: string, codeFrame?: string) {
    const Error = this.primitives.Error
    const error = new Error(message)
    Object.assign(error, { codeFrame })
    return error
  }

  public getMocks() {
    const suite = this.getSuiteFilepath()
    const suiteMocks = this.mockMap.get(suite)
    const globalMocks = this.mockMap.get('global')

    return {
      ...globalMocks,
      ...suiteMocks,
    }
  }

  private async resolvePath(rawId: string, importer: string) {
    let id: string
    let fsPath: string
    try {
      [id, fsPath] = await this.executor.originalResolveUrl(rawId, importer)
    }
    catch (error: any) {
      // it's allowed to mock unresolved modules
      if (error.code === 'ERR_MODULE_NOT_FOUND') {
        const { id: unresolvedId }
          = error[Symbol.for('vitest.error.not_found.data')]
        id = unresolvedId
        fsPath = unresolvedId
      }
      else {
        throw error
      }
    }
    // external is node_module or unresolved module
    // for example, some people mock "vscode" and don't have it installed
    const external
      = !isAbsolute(fsPath) || this.isModuleDirectory(fsPath) ? rawId : null

    return {
      id,
      fsPath,
      external,
    }
  }

  public async resolveMocks() {
    if (!VitestMocker.pendingIds.length) {
      return
    }

    await Promise.all(
      VitestMocker.pendingIds.map(async (mock) => {
        const { fsPath, external } = await this.resolvePath(
          mock.id,
          mock.importer,
        )
        if (mock.type === 'unmock') {
          this.unmockPath(fsPath)
        }
        if (mock.type === 'mock') {
          this.mockPath(mock.id, fsPath, external, mock.factory)
        }
      }),
    )

    VitestMocker.pendingIds = []
  }

  private async callFunctionMock(dep: string, mock: MockFactory) {
    const cached = this.moduleCache.get(dep)?.exports
    if (cached) {
      return cached
    }
    let exports: any
    try {
      exports = await mock()
    }
    catch (err) {
      const vitestError = this.createError(
        '[vitest] There was an error when mocking a module. '
        + 'If you are using "vi.mock" factory, make sure there are no top level variables inside, since this call is hoisted to top of the file. '
        + 'Read more: https://vitest.dev/api/vi.html#vi-mock',
      )
      vitestError.cause = err
      throw vitestError
    }

    const filepath = dep.slice(5)
    const mockpath
      = this.resolveCache.get(this.getSuiteFilepath())?.[filepath] || filepath

    if (exports === null || typeof exports !== 'object') {
      throw this.createError(
        `[vitest] vi.mock("${mockpath}", factory?: () => unknown) is not returning an object. Did you mean to return an object with a "default" key?`,
      )
    }

    const moduleExports = new Proxy(exports, {
      get: (target, prop) => {
        const val = target[prop]

        // 'then' can exist on non-Promise objects, need nested instanceof check for logic to work
        if (prop === 'then') {
          if (target instanceof Promise) {
            return target.then.bind(target)
          }
        }
        else if (!(prop in target)) {
          if (this.filterPublicKeys.includes(prop)) {
            return undefined
          }
          throw this.createError(
            `[vitest] No "${String(
              prop,
            )}" export is defined on the "${mockpath}" mock. `
            + 'Did you forget to return it from "vi.mock"?'
            + '\nIf you need to partially mock a module, you can use "importOriginal" helper inside:\n',
            highlight(`vi.mock("${mockpath}", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    // your mocked methods
  }
})`),
          )
        }

        return val
      },
    })

    this.moduleCache.set(dep, { exports: moduleExports })

    return moduleExports
  }

  public getMockContext() {
    return this.mockContext
  }

  public getMockPath(dep: string) {
    return `mock:${dep}`
  }

  public getDependencyMock(id: string) {
    return this.getMocks()[id]
  }

  public normalizePath(path: string) {
    return this.moduleCache.normalizePath(path)
  }

  public resolveMockPath(mockPath: string, external: string | null) {
    const path = external || mockPath

    // it's a node_module alias
    // all mocks should be inside <root>/__mocks__
    if (external || isNodeBuiltin(mockPath) || !existsSync(mockPath)) {
      const mockDirname = dirname(path) // for nested mocks: @vueuse/integration/useJwt
      const mockFolder = join(this.root, '__mocks__', mockDirname)

      if (!existsSync(mockFolder)) {
        return null
      }

      const files = readdirSync(mockFolder)
      const baseOriginal = basename(path)

      for (const file of files) {
        const baseFile = basename(file, extname(file))
        if (baseFile === baseOriginal) {
          return resolve(mockFolder, file)
        }
      }

      return null
    }

    const dir = dirname(path)
    const baseId = basename(path)
    const fullPath = resolve(dir, '__mocks__', baseId)
    return existsSync(fullPath) ? fullPath : null
  }

  public mockObject(
    object: Record<Key, any>,
    mockExports: Record<Key, any> = {},
  ) {
    if (!this.spyModule) {
      throw new Error('[vitest] `spyModule` is not defined. This is Vitest error. Please open a new issue with reproduction.')
    }

    return mockObject(this.spyModule, object, mockExports)
  }

  public unmockPath(path: string) {
    const suitefile = this.getSuiteFilepath()

    const id = this.normalizePath(path)

    const mock = this.mockMap.get(suitefile)
    if (mock && id in mock) {
      delete mock[id]
    }

    this.deleteCachedItem(id)
  }

  public mockPath(
    originalId: string,
    path: string,
    external: string | null,
    factory: MockFactory | undefined,
  ) {
    const id = this.normalizePath(path)

    // const { config } = this.executor.state
    // const isIsolatedThreads = config.pool === 'threads' && (config.poolOptions?.threads?.isolate ?? true)
    // const isIsolatedForks = config.pool === 'forks' && (config.poolOptions?.forks?.isolate ?? true)

    // TODO: find a good way to throw this error even in non-isolated mode
    // if (throwIfExists && (isIsolatedThreads || isIsolatedForks || config.pool === 'vmThreads')) {
    //   const cached = this.moduleCache.has(id) && this.moduleCache.getByModuleId(id)
    //   if (cached && cached.importers.size)
    //     throw new Error(`[vitest] Cannot mock "${originalId}" because it is already loaded by "${[...cached.importers.values()].map(i => relative(this.root, i)).join('", "')}".\n\nPlease, remove the import if you want static imports to be mocked, or clear module cache by calling "vi.resetModules()" before mocking if you are going to import the file again. See: https://vitest.dev/guide/common-errors.html#cannot-mock-mocked-file-js-because-it-is-already-loaded`)
    // }

    const suitefile = this.getSuiteFilepath()
    const mocks = this.mockMap.get(suitefile) || {}
    const resolves = this.resolveCache.get(suitefile) || {}

    mocks[id] = factory || this.resolveMockPath(path, external)
    resolves[id] = originalId

    this.mockMap.set(suitefile, mocks)
    this.resolveCache.set(suitefile, resolves)
    this.deleteCachedItem(id)
  }

  public async importActual<T>(
    rawId: string,
    importer: string,
    callstack?: string[] | null,
  ): Promise<T> {
    const { id, fsPath } = await this.resolvePath(rawId, importer)
    const result = await this.executor.cachedRequest(
      id,
      fsPath,
      callstack || [importer],
    )
    return result as T
  }

  public async importMock(rawId: string, importee: string): Promise<any> {
    const { id, fsPath, external } = await this.resolvePath(rawId, importee)

    const normalizedId = this.normalizePath(fsPath)
    let mock = this.getDependencyMock(normalizedId)

    if (mock === undefined) {
      mock = this.resolveMockPath(fsPath, external)
    }

    if (mock === null) {
      const mod = await this.executor.cachedRequest(id, fsPath, [importee])
      return this.mockObject(mod)
    }

    if (typeof mock === 'function') {
      return this.callFunctionMock(fsPath, mock)
    }
    return this.executor.dependencyRequest(mock, mock, [importee])
  }

  public async requestWithMock(url: string, callstack: string[]) {
    const id = this.normalizePath(url)
    const mock = this.getDependencyMock(id)

    const mockPath = this.getMockPath(id)

    if (mock === null) {
      const cache = this.moduleCache.get(mockPath)
      if (cache.exports) {
        return cache.exports
      }

      const exports = {}
      // Assign the empty exports object early to allow for cycles to work. The object will be filled by mockObject()
      this.moduleCache.set(mockPath, { exports })
      const mod = await this.executor.directRequest(url, url, callstack)
      this.mockObject(mod, exports)
      return exports
    }
    if (
      typeof mock === 'function'
      && !callstack.includes(mockPath)
      && !callstack.includes(url)
    ) {
      try {
        callstack.push(mockPath)
        // this will not work if user does Promise.all(import(), import())
        // we can also use AsyncLocalStorage to store callstack, but this won't work in the browser
        // maybe we should improve mock API in the future?
        this.mockContext.callstack = callstack
        return await this.callFunctionMock(mockPath, mock)
      }
      finally {
        this.mockContext.callstack = null
        const indexMock = callstack.indexOf(mockPath)
        callstack.splice(indexMock, 1)
      }
    }
    if (typeof mock === 'string' && !callstack.includes(mock)) {
      return mock
    }
  }

  public queueMock(
    id: string,
    importer: string,
    factory?: MockFactory,
    throwIfCached = false,
  ) {
    VitestMocker.pendingIds.push({
      type: 'mock',
      id,
      importer,
      factory,
      throwIfCached,
    })
  }

  public queueUnmock(id: string, importer: string, throwIfCached = false) {
    VitestMocker.pendingIds.push({
      type: 'unmock',
      id,
      importer,
      throwIfCached,
    })
  }
}

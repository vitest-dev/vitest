import { existsSync, readdirSync } from 'node:fs'
import vm from 'node:vm'
import { basename, dirname, extname, isAbsolute, join, resolve } from 'pathe'
import { getColors, getType } from '@vitest/utils'
import { isNodeBuiltin } from 'vite-node/utils'
import { distDir } from '../paths'
import { getAllMockableProperties } from '../utils/base'
import type { MockFactory, PendingSuiteMock } from '../types/mocker'
import type { VitestExecutor } from './execute'

const spyModulePath = resolve(distDir, 'spy.js')

class RefTracker {
  private idMap = new Map<any, number>()
  private mockedValueMap = new Map<number, any>()

  public getId(value: any) {
    return this.idMap.get(value)
  }

  public getMockedValue(id: number) {
    return this.mockedValueMap.get(id)
  }

  public track(originalValue: any, mockedValue: any): number {
    const newId = this.idMap.size
    this.idMap.set(originalValue, newId)
    this.mockedValueMap.set(newId, mockedValue)
    return newId
  }
}

type Key = string | symbol

interface MockContext {
  /**
   * When mocking with a factory, this refers to the module that imported the mock.
   */
  callstack: null | string[]
}

function isSpecialProp(prop: Key, parentType: string) {
  return parentType.includes('Function')
      && typeof prop === 'string'
      && ['arguments', 'callee', 'caller', 'length', 'name'].includes(prop)
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

  constructor(
    public executor: VitestExecutor,
  ) {
    const context = this.executor.options.context
    if (context)
      this.primitives = vm.runInContext('({ Object, Error, Function, RegExp, Symbol, Array, Map })', context)
    else
      this.primitives = { Object, Error, Function, RegExp, Symbol: globalThis.Symbol, Array, Map }

    const Symbol = this.primitives.Symbol

    this.filterPublicKeys = ['__esModule', Symbol.asyncIterator, Symbol.hasInstance, Symbol.isConcatSpreadable, Symbol.iterator, Symbol.match, Symbol.matchAll, Symbol.replace, Symbol.search, Symbol.split, Symbol.species, Symbol.toPrimitive, Symbol.toStringTag, Symbol.unscopables]
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
    if (this.moduleCache.has(mockId))
      this.moduleCache.delete(mockId)
  }

  private isAModuleDirectory(path: string) {
    return this.moduleDirectories.some(dir => path.includes(dir))
  }

  public getSuiteFilepath(): string {
    return this.executor.state.filepath || 'global'
  }

  private createError(message: string) {
    const Error = this.primitives.Error
    return new Error(message)
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
        const { id: unresolvedId } = error[Symbol.for('vitest.error.not_found.data')]
        id = unresolvedId
        fsPath = unresolvedId
      }
      else {
        throw error
      }
    }
    // external is node_module or unresolved module
    // for example, some people mock "vscode" and don't have it installed
    const external = (!isAbsolute(fsPath) || this.isAModuleDirectory(fsPath)) ? rawId : null

    return {
      id,
      fsPath,
      external,
    }
  }

  public async resolveMocks() {
    if (!VitestMocker.pendingIds.length)
      return

    await Promise.all(VitestMocker.pendingIds.map(async (mock) => {
      const { fsPath, external } = await this.resolvePath(mock.id, mock.importer)
      if (mock.type === 'unmock')
        this.unmockPath(fsPath)
      if (mock.type === 'mock')
        this.mockPath(mock.id, fsPath, external, mock.factory, mock.throwIfCached)
    }))

    VitestMocker.pendingIds = []
  }

  private async callFunctionMock(dep: string, mock: MockFactory) {
    const cached = this.moduleCache.get(dep)?.exports
    if (cached)
      return cached
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
    const mockpath = this.resolveCache.get(this.getSuiteFilepath())?.[filepath] || filepath

    if (exports === null || typeof exports !== 'object')
      throw this.createError(`[vitest] vi.mock("${mockpath}", factory?: () => unknown) is not returning an object. Did you mean to return an object with a "default" key?`)

    const moduleExports = new Proxy(exports, {
      get: (target, prop) => {
        const val = target[prop]

        // 'then' can exist on non-Promise objects, need nested instanceof check for logic to work
        if (prop === 'then') {
          if (target instanceof Promise)
            return target.then.bind(target)
        }
        else if (!(prop in target)) {
          if (this.filterPublicKeys.includes(prop))
            return undefined
          const c = getColors()
          throw this.createError(
            `[vitest] No "${String(prop)}" export is defined on the "${mockpath}" mock. `
            + 'Did you forget to return it from "vi.mock"?'
            + '\nIf you need to partially mock a module, you can use "importOriginal" helper inside:\n\n'
            + `${c.green(`vi.mock("${mockpath}", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    // your mocked methods
  }
})`)}\n`,
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

      if (!existsSync(mockFolder))
        return null

      const files = readdirSync(mockFolder)
      const baseOriginal = basename(path)

      for (const file of files) {
        const baseFile = basename(file, extname(file))
        if (baseFile === baseOriginal)
          return resolve(mockFolder, file)
      }

      return null
    }

    const dir = dirname(path)
    const baseId = basename(path)
    const fullPath = resolve(dir, '__mocks__', baseId)
    return existsSync(fullPath) ? fullPath : null
  }

  public mockObject(object: Record<Key, any>, mockExports: Record<Key, any> = {}) {
    const finalizers = new Array<() => void>()
    const refs = new RefTracker()

    const define = (container: Record<Key, any>, key: Key, value: any) => {
      try {
        container[key] = value
        return true
      }
      catch {
        return false
      }
    }

    const mockPropertiesOf = (container: Record<Key, any>, newContainer: Record<Key, any>) => {
      const containerType = getType(container)
      const isModule = containerType === 'Module' || !!container.__esModule
      for (const { key: property, descriptor } of getAllMockableProperties(container, isModule, this.primitives)) {
        // Modules define their exports as getters. We want to process those.
        if (!isModule && descriptor.get) {
          try {
            Object.defineProperty(newContainer, property, descriptor)
          }
          catch (error) {
            // Ignore errors, just move on to the next prop.
          }
          continue
        }

        // Skip special read-only props, we don't want to mess with those.
        if (isSpecialProp(property, containerType))
          continue

        const value = container[property]

        // Special handling of references we've seen before to prevent infinite
        // recursion in circular objects.
        const refId = refs.getId(value)
        if (refId !== undefined) {
          finalizers.push(() => define(newContainer, property, refs.getMockedValue(refId)))
          continue
        }

        const type = getType(value)

        if (Array.isArray(value)) {
          define(newContainer, property, [])
          continue
        }

        const isFunction = type.includes('Function') && typeof value === 'function'
        if ((!isFunction || value.__isMockFunction) && type !== 'Object' && type !== 'Module') {
          define(newContainer, property, value)
          continue
        }

        // Sometimes this assignment fails for some unknown reason. If it does,
        // just move along.
        if (!define(newContainer, property, isFunction ? value : {}))
          continue

        if (isFunction) {
          if (!this.spyModule)
            throw this.createError('[vitest] `spyModule` is not defined. This is Vitest error. Please open a new issue with reproduction.')
          const spyModule = this.spyModule
          const primitives = this.primitives
          function mockFunction(this: any) {
            // detect constructor call and mock each instance's methods
            // so that mock states between prototype/instances don't affect each other
            // (jest reference https://github.com/jestjs/jest/blob/2c3d2409879952157433de215ae0eee5188a4384/packages/jest-mock/src/index.ts#L678-L691)
            if (this instanceof newContainer[property]) {
              for (const { key, descriptor } of getAllMockableProperties(this, false, primitives)) {
                // skip getter since it's not mocked on prototype as well
                if (descriptor.get)
                  continue

                const value = this[key]
                const type = getType(value)
                const isFunction = type.includes('Function') && typeof value === 'function'
                if (isFunction) {
                  // mock and delegate calls to original prototype method, which should be also mocked already
                  const original = this[key]
                  const mock = spyModule.spyOn(this, key as string).mockImplementation(original)
                  mock.mockRestore = () => {
                    mock.mockReset()
                    mock.mockImplementation(original)
                    return mock
                  }
                }
              }
            }
          }
          const mock = spyModule.spyOn(newContainer, property).mockImplementation(mockFunction)
          mock.mockRestore = () => {
            mock.mockReset()
            mock.mockImplementation(mockFunction)
            return mock
          }
          // tinyspy retains length, but jest doesn't.
          Object.defineProperty(newContainer[property], 'length', { value: 0 })
        }

        refs.track(value, newContainer[property])
        mockPropertiesOf(value, newContainer[property])
      }
    }

    const mockedObject: Record<Key, any> = mockExports
    mockPropertiesOf(object, mockedObject)

    // Plug together refs
    for (const finalizer of finalizers)
      finalizer()

    return mockedObject
  }

  public unmockPath(path: string) {
    const suitefile = this.getSuiteFilepath()

    const id = this.normalizePath(path)

    const mock = this.mockMap.get(suitefile)
    if (mock && id in mock)
      delete mock[id]

    this.deleteCachedItem(id)
  }

  public mockPath(originalId: string, path: string, external: string | null, factory: MockFactory | undefined, throwIfExists: boolean) {
    const id = this.normalizePath(path)

    if (throwIfExists && this.moduleCache.has(id))
      throw new Error(`[vitest] Cannot mock "${originalId}" because it is already loaded. Did you import it in a setup file?\n\nPlease, remove the import if you want static imports to be mocked, or clear module cache by calling "vi.resetModules()" before mocking if you are going to import the file again. See: https://vitest.dev/guide/common-errors.html#cannot-mock-mocked-file.js-because-it-is-already-loaded`)

    const suitefile = this.getSuiteFilepath()
    const mocks = this.mockMap.get(suitefile) || {}
    const resolves = this.resolveCache.get(suitefile) || {}

    mocks[id] = factory || this.resolveMockPath(path, external)
    resolves[id] = originalId

    this.mockMap.set(suitefile, mocks)
    this.resolveCache.set(suitefile, resolves)
    this.deleteCachedItem(id)
  }

  public async importActual<T>(rawId: string, importer: string, callstack?: string[] | null): Promise<T> {
    const { id, fsPath } = await this.resolvePath(rawId, importer)
    const result = await this.executor.cachedRequest(id, fsPath, callstack || [importer])
    return result as T
  }

  public async importMock(rawId: string, importee: string): Promise<any> {
    const { id, fsPath, external } = await this.resolvePath(rawId, importee)

    const normalizedId = this.normalizePath(fsPath)
    let mock = this.getDependencyMock(normalizedId)

    if (mock === undefined)
      mock = this.resolveMockPath(fsPath, external)

    if (mock === null) {
      const mod = await this.executor.cachedRequest(id, fsPath, [importee])
      return this.mockObject(mod)
    }

    if (typeof mock === 'function')
      return this.callFunctionMock(fsPath, mock)
    return this.executor.dependencyRequest(mock, mock, [importee])
  }

  public async requestWithMock(url: string, callstack: string[]) {
    const id = this.normalizePath(url)
    const mock = this.getDependencyMock(id)

    const mockPath = this.getMockPath(id)

    if (mock === null) {
      const cache = this.moduleCache.get(mockPath)
      if (cache.exports)
        return cache.exports

      const exports = {}
      // Assign the empty exports object early to allow for cycles to work. The object will be filled by mockObject()
      this.moduleCache.set(mockPath, { exports })
      const mod = await this.executor.directRequest(url, url, callstack)
      this.mockObject(mod, exports)
      return exports
    }
    if (typeof mock === 'function' && !callstack.includes(mockPath) && !callstack.includes(url)) {
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
    if (typeof mock === 'string' && !callstack.includes(mock))
      return mock
  }

  public queueMock(id: string, importer: string, factory?: MockFactory, throwIfCached = false) {
    VitestMocker.pendingIds.push({ type: 'mock', id, importer, factory, throwIfCached })
  }

  public queueUnmock(id: string, importer: string, throwIfCached = false) {
    VitestMocker.pendingIds.push({ type: 'unmock', id, importer, throwIfCached })
  }
}

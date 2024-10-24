import type { ManualMockedModule, MockedModuleType } from '@vitest/mocker'
import type { MockFactory, MockOptions, PendingSuiteMock } from '../types/mocker'
import type { VitestExecutor } from './execute'
import { isAbsolute, resolve } from 'node:path'
import vm from 'node:vm'
import { AutomockedModule, MockerRegistry, mockObject, RedirectedModule } from '@vitest/mocker'
import { findMockRedirect } from '@vitest/mocker/redirect'
import { highlight } from '@vitest/utils'
import { distDir } from '../paths'

const spyModulePath = resolve(distDir, 'spy.js')

interface MockContext {
  /**
   * When mocking with a factory, this refers to the module that imported the mock.
   */
  callstack: null | string[]
}

export class VitestMocker {
  static pendingIds: PendingSuiteMock[] = []
  private spyModule?: typeof import('@vitest/spy')
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

  private registries = new Map<string, MockerRegistry>()

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

  private get moduleCache() {
    return this.executor.moduleCache
  }

  private get moduleDirectories() {
    return this.executor.options.moduleDirectories || []
  }

  public async initializeSpyModule() {
    this.spyModule = await this.executor.executeId(spyModulePath)
  }

  private getMockerRegistry() {
    const suite = this.getSuiteFilepath()
    if (!this.registries.has(suite)) {
      this.registries.set(suite, new MockerRegistry())
    }
    return this.registries.get(suite)!
  }

  public reset() {
    this.registries.clear()
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
      external: external ? this.normalizePath(external) : external,
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
        if (mock.action === 'unmock') {
          this.unmockPath(fsPath)
        }
        if (mock.action === 'mock') {
          this.mockPath(
            mock.id,
            fsPath,
            external,
            mock.type,
            mock.factory,
          )
        }
      }),
    )

    VitestMocker.pendingIds = []
  }

  private async callFunctionMock(dep: string, mock: ManualMockedModule) {
    const cached = this.moduleCache.get(dep)?.exports
    if (cached) {
      return cached
    }
    const exports = await mock.resolve()

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
            `[vitest] No "${String(prop)}" export is defined on the "${mock.raw}" mock. `
            + 'Did you forget to return it from "vi.mock"?'
            + '\nIf you need to partially mock a module, you can use "importOriginal" helper inside:\n',
            highlight(`vi.mock(import("${mock.raw}"), async (importOriginal) => {
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

  // public method to avoid circular dependency
  public getMockContext() {
    return this.mockContext
  }

  // path used to store mocked dependencies
  public getMockPath(dep: string) {
    return `mock:${dep}`
  }

  public getDependencyMock(id: string) {
    const registry = this.getMockerRegistry()
    return registry.get(id)
  }

  public normalizePath(path: string) {
    return this.moduleCache.normalizePath(path)
  }

  public resolveMockPath(mockPath: string, external: string | null) {
    return findMockRedirect(this.root, mockPath, external)
  }

  public mockObject(
    object: Record<string | symbol, any>,
    mockExports: Record<string | symbol, any> = {},
    behavior: MockedModuleType = 'automock',
  ) {
    const spyOn = this.spyModule?.spyOn
    if (!spyOn) {
      throw this.createError(
        '[vitest] `spyModule` is not defined. This is a Vitest error. Please open a new issue with reproduction.',
      )
    }
    return mockObject({
      globalConstructors: this.primitives,
      spyOn,
      type: behavior,
    }, object, mockExports)
  }

  public unmockPath(path: string) {
    const registry = this.getMockerRegistry()
    const id = this.normalizePath(path)

    registry.delete(id)
    this.deleteCachedItem(id)
  }

  public mockPath(
    originalId: string,
    path: string,
    external: string | null,
    mockType: MockedModuleType | undefined,
    factory: MockFactory | undefined,
  ) {
    const registry = this.getMockerRegistry()
    const id = this.normalizePath(path)

    if (mockType === 'manual') {
      registry.register('manual', originalId, id, factory!)
    }
    else if (mockType === 'autospy') {
      registry.register('autospy', originalId, id)
    }
    else {
      const redirect = this.resolveMockPath(id, external)
      if (redirect) {
        registry.register('redirect', originalId, id, redirect)
      }
      else {
        registry.register('automock', originalId, id)
      }
    }

    // every time the mock is registered, we remove the previous one from the cache
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

    if (!mock) {
      const redirect = this.resolveMockPath(normalizedId, external)
      if (redirect) {
        mock = new RedirectedModule(rawId, normalizedId, redirect)
      }
      else {
        mock = new AutomockedModule(rawId, normalizedId)
      }
    }

    if (mock.type === 'automock' || mock.type === 'autospy') {
      const mod = await this.executor.cachedRequest(id, fsPath, [importee])
      return this.mockObject(mod, {}, mock.type)
    }

    if (mock.type === 'manual') {
      return this.callFunctionMock(fsPath, mock)
    }
    return this.executor.dependencyRequest(mock.redirect, mock.redirect, [importee])
  }

  public async requestWithMock(url: string, callstack: string[]) {
    const id = this.normalizePath(url)
    const mock = this.getDependencyMock(id)

    if (!mock) {
      return
    }

    const mockPath = this.getMockPath(id)

    if (mock.type === 'automock' || mock.type === 'autospy') {
      const cache = this.moduleCache.get(mockPath)
      if (cache.exports) {
        return cache.exports
      }
      const exports = {}
      // Assign the empty exports object early to allow for cycles to work. The object will be filled by mockObject()
      this.moduleCache.set(mockPath, { exports })
      const mod = await this.executor.directRequest(url, url, callstack)
      this.mockObject(mod, exports, mock.type)
      return exports
    }
    if (
      mock.type === 'manual'
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
    else if (mock.type === 'redirect' && !callstack.includes(mock.redirect)) {
      return mock.redirect
    }
  }

  public queueMock(
    id: string,
    importer: string,
    factoryOrOptions?: MockFactory | MockOptions,
  ) {
    const mockType = getMockType(factoryOrOptions)
    VitestMocker.pendingIds.push({
      action: 'mock',
      id,
      importer,
      factory: typeof factoryOrOptions === 'function' ? factoryOrOptions : undefined,
      type: mockType,
    })
  }

  public queueUnmock(id: string, importer: string) {
    VitestMocker.pendingIds.push({
      action: 'unmock',
      id,
      importer,
    })
  }
}

function getMockType(factoryOrOptions?: MockFactory | MockOptions): MockedModuleType {
  if (!factoryOrOptions) {
    return 'automock'
  }
  if (typeof factoryOrOptions === 'function') {
    return 'manual'
  }
  return factoryOrOptions.spy ? 'autospy' : 'automock'
}

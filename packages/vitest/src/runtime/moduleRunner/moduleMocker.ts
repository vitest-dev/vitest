import type { ManualMockedModule, MockedModule, MockedModuleType } from '@vitest/mocker'
import type { EvaluatedModuleNode } from 'vite/module-runner'
import type { MockFactory, MockOptions, PendingSuiteMock } from '../../types/mocker'
import type { VitestModuleRunner } from './moduleRunner'
import { isAbsolute, resolve } from 'node:path'
import vm from 'node:vm'
import { AutomockedModule, MockerRegistry, mockObject, RedirectedModule } from '@vitest/mocker'
import { findMockRedirect } from '@vitest/mocker/redirect'
import { highlight } from '@vitest/utils'
import { distDir } from '../../paths'

const spyModulePath = resolve(distDir, 'spy.js')

interface MockContext {
  /**
   * When mocking with a factory, this refers to the module that imported the mock.
   */
  callstack: null | string[]
}

export interface VitestMockerOptions {
  context?: vm.Context

  root: string
  moduleDirectories: string[]
  resolveId: (id: string, importer?: string) => Promise<{
    id: string
    file: string
    url: string
  } | null>
  getCurrentTestFilepath: () => string | undefined
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

  constructor(public moduleRunner: VitestModuleRunner, private options: VitestMockerOptions) {
    const context = this.options.context
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
    return this.options.root
  }

  private get evaluatedModules() {
    return this.moduleRunner.evaluatedModules
  }

  private get moduleDirectories() {
    return this.options.moduleDirectories || []
  }

  public async initializeSpyModule(): Promise<void> {
    if (this.spyModule) {
      return
    }

    this.spyModule = await this.moduleRunner.import(spyModulePath)
  }

  private getMockerRegistry() {
    const suite = this.getSuiteFilepath()
    if (!this.registries.has(suite)) {
      this.registries.set(suite, new MockerRegistry())
    }
    return this.registries.get(suite)!
  }

  public reset(): void {
    this.registries.clear()
  }

  private invalidateModuleById(id: string) {
    const mockId = this.getMockPath(id)
    const node = this.evaluatedModules.getModuleById(mockId)
    if (node) {
      this.evaluatedModules.invalidateModule(node)
      node.mockedExports = undefined
    }
  }

  private isModuleDirectory(path: string) {
    return this.moduleDirectories.some(dir => path.includes(dir))
  }

  public getSuiteFilepath(): string {
    return this.options.getCurrentTestFilepath() || 'global'
  }

  private createError(message: string, codeFrame?: string) {
    const Error = this.primitives.Error
    const error = new Error(message)
    Object.assign(error, { codeFrame })
    return error
  }

  public async resolveId(rawId: string, importer?: string): Promise<{
    id: string
    url: string
    external: string | null
  }> {
    const result = await this.options.resolveId(rawId, importer)
    if (!result) {
      const id = normalizeModuleId(rawId)
      return {
        id,
        url: rawId,
        external: id,
      }
    }
    // external is node_module or unresolved module
    // for example, some people mock "vscode" and don't have it installed
    const external
      = !isAbsolute(result.file) || this.isModuleDirectory(result.file) ? normalizeModuleId(rawId) : null
    return {
      ...result,
      id: normalizeModuleId(result.id),
      external,
    }
  }

  public async resolveMocks(): Promise<void> {
    if (!VitestMocker.pendingIds.length) {
      return
    }

    await Promise.all(
      VitestMocker.pendingIds.map(async (mock) => {
        const { id, url, external } = await this.resolveId(
          mock.id,
          mock.importer,
        )
        if (mock.action === 'unmock') {
          this.unmockPath(id)
        }
        if (mock.action === 'mock') {
          this.mockPath(
            mock.id,
            id,
            url,
            external,
            mock.type,
            mock.factory,
          )
        }
      }),
    )

    VitestMocker.pendingIds = []
  }

  private ensureModule(id: string, url: string) {
    const node = this.evaluatedModules.ensureModule(id, url)
    // TODO
    node.meta = { id, url, code: '', file: null, invalidate: false }
    return node
  }

  private async callFunctionMock(id: string, url: string, mock: ManualMockedModule) {
    const node = this.ensureModule(id, url)
    if (node.exports) {
      return node.exports
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

    node.exports = moduleExports

    return moduleExports
  }

  // public method to avoid circular dependency
  public getMockContext(): MockContext {
    return this.mockContext
  }

  // path used to store mocked dependencies
  public getMockPath(dep: string) {
    return `mock:${dep}`
  }

  public getDependencyMock(id: string): MockedModule | undefined {
    const registry = this.getMockerRegistry()
    return registry.getById(fixLeadingSlashes(id))
  }

  public findMockRedirect(mockPath: string, external: string | null): string | null {
    return findMockRedirect(this.root, mockPath, external)
  }

  public mockObject(
    object: Record<string | symbol, any>,
    mockExports: Record<string | symbol, any> = {},
    behavior: 'automock' | 'autospy' = 'automock',
  ): Record<string | symbol, any> {
    const createMockInstance = this.spyModule?.createMockInstance
    if (!createMockInstance) {
      throw this.createError(
        '[vitest] `spyModule` is not defined. This is a Vitest error. Please open a new issue with reproduction.',
      )
    }
    return mockObject(
      {
        globalConstructors: this.primitives,
        createMockInstance,
        type: behavior,
      },
      object,
      mockExports,
    )
  }

  public unmockPath(id: string): void {
    const registry = this.getMockerRegistry()

    registry.deleteById(id)
    this.invalidateModuleById(id)
  }

  public mockPath(
    originalId: string,
    id: string,
    url: string,
    external: string | null,
    mockType: MockedModuleType | undefined,
    factory: MockFactory | undefined,
  ): void {
    const registry = this.getMockerRegistry()

    if (mockType === 'manual') {
      registry.register('manual', originalId, id, url, factory!)
    }
    else if (mockType === 'autospy') {
      registry.register('autospy', originalId, id, url)
    }
    else {
      const redirect = this.findMockRedirect(id, external)
      if (redirect) {
        registry.register('redirect', originalId, id, url, redirect)
      }
      else {
        registry.register('automock', originalId, id, url)
      }
    }

    // every time the mock is registered, we remove the previous one from the cache
    this.invalidateModuleById(id)
  }

  public async importActual<T>(
    rawId: string,
    importer: string,
    callstack?: string[] | null,
  ): Promise<T> {
    const { url } = await this.resolveId(rawId, importer)
    const node = await this.moduleRunner.fetchModule(url, importer)
    const result = await this.moduleRunner.cachedRequest(
      node.url,
      node,
      callstack || [importer],
      undefined,
      true,
    )
    return result as T
  }

  public async importMock(rawId: string, importer: string): Promise<any> {
    const { id, url, external } = await this.resolveId(rawId, importer)

    let mock = this.getDependencyMock(id)

    if (!mock) {
      const redirect = this.findMockRedirect(id, external)
      if (redirect) {
        mock = new RedirectedModule(rawId, id, rawId, redirect)
      }
      else {
        mock = new AutomockedModule(rawId, id, rawId)
      }
    }

    if (mock.type === 'automock' || mock.type === 'autospy') {
      const node = await this.moduleRunner.fetchModule(url, importer)
      const mod = await this.moduleRunner.cachedRequest(url, node, [importer], undefined, true)
      const Object = this.primitives.Object
      return this.mockObject(mod, Object.create(Object.prototype), mock.type)
    }

    if (mock.type === 'manual') {
      return this.callFunctionMock(id, url, mock)
    }
    const node = await this.moduleRunner.fetchModule(mock.redirect)
    return this.moduleRunner.cachedRequest(
      mock.redirect,
      node,
      [importer],
      undefined,
      true,
    )
  }

  public async requestWithMockedModule(
    url: string,
    evaluatedNode: EvaluatedModuleNode,
    callstack: string[],
    mock: MockedModule,
  ): Promise<any> {
    const mockId = this.getMockPath(evaluatedNode.id)

    if (mock.type === 'automock' || mock.type === 'autospy') {
      const cache = this.evaluatedModules.getModuleById(mockId)
      if (cache && cache.mockedExports) {
        return cache.mockedExports
      }
      const Object = this.primitives.Object
      // we have to define a separate object that will copy all properties into itself
      // and can't just use the same `exports` define automatically by Vite before the evaluator
      const exports = Object.create(null)
      Object.defineProperty(exports, Symbol.toStringTag, {
        value: 'Module',
        configurable: true,
        writable: true,
      })
      const node = this.ensureModule(mockId, this.getMockPath(evaluatedNode.url))
      node.meta = evaluatedNode.meta
      node.file = evaluatedNode.file
      node.mockedExports = exports

      const mod = await this.moduleRunner.cachedRequest(
        url,
        node,
        callstack,
        undefined,
        true,
      )
      this.mockObject(mod, exports, mock.type)
      return exports
    }
    if (
      mock.type === 'manual'
      && !callstack.includes(mockId)
      && !callstack.includes(url)
    ) {
      try {
        callstack.push(mockId)
        // this will not work if user does Promise.all(import(), import())
        // we can also use AsyncLocalStorage to store callstack, but this won't work in the browser
        // maybe we should improve mock API in the future?
        this.mockContext.callstack = callstack
        return await this.callFunctionMock(mockId, this.getMockPath(url), mock)
      }
      finally {
        this.mockContext.callstack = null
        const indexMock = callstack.indexOf(mockId)
        callstack.splice(indexMock, 1)
      }
    }
    else if (mock.type === 'redirect' && !callstack.includes(mock.redirect)) {
      return mock.redirect
    }
  }

  public async mockedRequest(url: string, evaluatedNode: EvaluatedModuleNode, callstack: string[]): Promise<any> {
    const mock = this.getDependencyMock(evaluatedNode.id)

    if (!mock) {
      return
    }

    return this.requestWithMockedModule(url, evaluatedNode, callstack, mock)
  }

  public queueMock(
    id: string,
    importer: string,
    factoryOrOptions?: MockFactory | MockOptions,
  ): void {
    const mockType = getMockType(factoryOrOptions)
    VitestMocker.pendingIds.push({
      action: 'mock',
      id,
      importer,
      factory: typeof factoryOrOptions === 'function' ? factoryOrOptions : undefined,
      type: mockType,
    })
  }

  public queueUnmock(id: string, importer: string): void {
    VitestMocker.pendingIds.push({
      action: 'unmock',
      id,
      importer,
    })
  }
}

declare module 'vite/module-runner' {
  interface EvaluatedModuleNode {
    mockedExports?: Record<string, any>
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

// unique id that is not available as "$bare_import" like "test"
// https://nodejs.org/api/modules.html#built-in-modules-with-mandatory-node-prefix
const prefixedBuiltins = new Set([
  'node:sea',
  'node:sqlite',
  'node:test',
  'node:test/reporters',
])

const isWindows = process.platform === 'win32'

// transform file url to id
// virtual:custom -> virtual:custom
// \0custom -> \0custom
// /root/id -> /id
// /root/id.js -> /id.js
// C:/root/id.js -> /id.js
// C:\root\id.js -> /id.js
// TODO: expose this in vite/module-runner
function normalizeModuleId(file: string): string {
  if (prefixedBuiltins.has(file)) {
    return file
  }

  // unix style, but Windows path still starts with the drive letter to check the root
  const unixFile = slash(file)
    .replace(/^\/@fs\//, isWindows ? '' : '/')
    .replace(/^node:/, '')
    .replace(/^\/+/, '/')

  // if it's not in the root, keep it as a path, not a URL
  return unixFile.replace(/^file:\//, '/')
}

const windowsSlashRE = /\\/g
function slash(p: string): string {
  return p.replace(windowsSlashRE, '/')
}

const multipleSlashRe = /^\/+/
// module-runner incorrectly replaces file:///path with `///path`
function fixLeadingSlashes(id: string): string {
  if (id.startsWith('//')) {
    return id.replace(multipleSlashRe, '/')
  }
  return id
}

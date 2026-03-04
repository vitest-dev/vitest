import type { MockedModule, MockedModuleType, ModuleMockContext, TestModuleMocker } from '@vitest/mocker'
import type { MockFactory, MockOptions, PendingSuiteMock } from '../../types/mocker'
import type { Traces } from '../../utils/traces'
import { isAbsolute } from 'node:path'
import { MockerRegistry, mockObject } from '@vitest/mocker'
import { findMockRedirect } from '@vitest/mocker/redirect'

export interface BareModuleMockerOptions {
  /**
   * @internal
   */
  traces: Traces
  spyModule?: typeof import('@vitest/spy')
  root: string
  moduleDirectories: string[]
  resolveId: (id: string, importer?: string) => Promise<{
    id: string
    file: string
    url: string
  } | null>
  getCurrentTestFilepath: () => string | undefined
}

export class BareModuleMocker implements TestModuleMocker {
  static pendingIds: PendingSuiteMock[] = []
  protected spyModule?: typeof import('@vitest/spy')
  protected primitives: {
    Object: typeof Object
    Function: typeof Function
    RegExp: typeof RegExp
    Array: typeof Array
    Map: typeof Map
    Error: typeof Error
    Symbol: typeof Symbol
  }

  protected registries: Map<string, MockerRegistry> = new Map<string, MockerRegistry>()

  protected mockContext: ModuleMockContext = {
    callstack: null,
  }

  protected _otel: Traces

  constructor(protected options: BareModuleMockerOptions) {
    this._otel = options.traces
    this.primitives = {
      Object,
      Error,
      Function,
      RegExp,
      Symbol: globalThis.Symbol,
      Array,
      Map,
    }

    if (options.spyModule) {
      this.spyModule = options.spyModule
    }
  }

  protected get root(): string {
    return this.options.root
  }

  protected get moduleDirectories(): string[] {
    return this.options.moduleDirectories || []
  }

  protected getMockerRegistry(): MockerRegistry {
    const suite = this.getSuiteFilepath()
    if (!this.registries.has(suite)) {
      this.registries.set(suite, new MockerRegistry())
    }
    return this.registries.get(suite)!
  }

  public reset(): void {
    this.registries.clear()
  }

  protected invalidateModuleById(_id: string): void {
    // implemented by mockers that control the module runner
  }

  protected isModuleDirectory(path: string): boolean {
    return this.moduleDirectories.some(dir => path.includes(dir))
  }

  public getSuiteFilepath(): string {
    return this.options.getCurrentTestFilepath() || 'global'
  }

  protected createError(message: string, codeFrame?: string): Error {
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
    return this._otel.$(
      'vitest.mocker.resolve_id',
      {
        attributes: {
          'vitest.module.raw_id': rawId,
          'vitest.module.importer': rawId,
        },
      },
      async (span) => {
        const result = await this.options.resolveId(rawId, importer)
        if (!result) {
          span.addEvent('could not resolve id, fallback to unresolved values')
          const id = normalizeModuleId(rawId)
          span.setAttributes({
            'vitest.module.id': id,
            'vitest.module.url': rawId,
            'vitest.module.external': id,
            'vitest.module.fallback': true,
          })
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
        const id = normalizeModuleId(result.id)
        span.setAttributes({
          'vitest.module.id': id,
          'vitest.module.url': result.url,
          'vitest.module.external': external ?? false,
        })
        return {
          ...result,
          id,
          external,
        }
      },
    )
  }

  public async resolveMocks(): Promise<void> {
    if (!BareModuleMocker.pendingIds.length) {
      return
    }

    await Promise.all(
      BareModuleMocker.pendingIds.map(async (mock) => {
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

    BareModuleMocker.pendingIds = []
  }

  // public method to avoid circular dependency
  public getMockContext(): ModuleMockContext {
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
    moduleType?: 'automock' | 'autospy',
  ): Record<string | symbol, any>
  public mockObject(
    object: Record<string | symbol, any>,
    mockExports: Record<string | symbol, any> | undefined,
    moduleType?: 'automock' | 'autospy',
  ): Record<string | symbol, any>
  public mockObject(
    object: Record<string | symbol, any>,
    mockExportsOrModuleType?: Record<string | symbol, any> | 'automock' | 'autospy',
    moduleType?: 'automock' | 'autospy',
  ): Record<string | symbol, any> {
    let mockExports: Record<string | symbol, any> | undefined
    if (mockExportsOrModuleType === 'automock' || mockExportsOrModuleType === 'autospy') {
      moduleType = mockExportsOrModuleType
      mockExports = undefined
    }
    else {
      mockExports = mockExportsOrModuleType
    }
    moduleType ??= 'automock'
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
        type: moduleType,
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

  async importActual<T>(_rawId: string, _importer: string, _callstack?: string[] | null): Promise<T> {
    throw new Error(`importActual is not implemented`)
  }

  async importMock<T>(_rawId: string, _importer: string, _callstack?: string[] | null): Promise<T> {
    throw new Error(`importMock is not implemented`)
  }

  public queueMock(
    id: string,
    importer: string,
    factoryOrOptions?: MockFactory | MockOptions,
  ): void {
    const mockType = getMockType(factoryOrOptions)
    BareModuleMocker.pendingIds.push({
      action: 'mock',
      id,
      importer,
      factory: typeof factoryOrOptions === 'function' ? factoryOrOptions : undefined,
      type: mockType,
    })
  }

  public queueUnmock(id: string, importer: string): void {
    BareModuleMocker.pendingIds.push({
      action: 'unmock',
      id,
      importer,
    })
  }
}

declare module 'vite/module-runner' {
  interface EvaluatedModuleNode {
    /**
     * @internal
     */
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
export function normalizeModuleId(file: string): string {
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

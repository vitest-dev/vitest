import { existsSync, readdirSync } from 'fs'
import { isNodeBuiltin } from 'mlly'
import { basename, dirname, extname, join, resolve } from 'pathe'
import { normalizeRequestId, pathFromRoot } from 'vite-node/utils'
import type { ModuleCacheMap } from 'vite-node/client'
import { getAllMockableProperties, getType, getWorkerState, mergeSlashes, slash } from '../utils'
import { distDir } from '../constants'
import type { PendingSuiteMock } from '../types/mocker'
import type { ExecuteOptions } from './execute'

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

function isSpecialProp(prop: Key, parentType: string) {
  return parentType.includes('Function')
      && typeof prop === 'string'
      && ['arguments', 'callee', 'caller', 'length', 'name'].includes(prop)
}

interface ViteRunnerRequest {
  (dep: string): any
  callstack: string[]
}

export class VitestMocker {
  private static pendingIds: PendingSuiteMock[] = []
  private static spyModule?: typeof import('../integrations/spy')

  constructor(
    public options: ExecuteOptions,
    private moduleCache: ModuleCacheMap,
    private request: ViteRunnerRequest,
  ) {}

  private get root() {
    return this.options.root
  }

  private get base() {
    return this.options.base
  }

  private get mockMap() {
    return this.options.mockMap
  }

  public getSuiteFilepath(): string {
    return getWorkerState().filepath || 'global'
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

  private async resolvePath(id: string, importer: string) {
    const path = await this.options.resolveId!(id, importer)
    // external is node_module or unresolved module
    // for example, some people mock "vscode" and don't have it installed
    const external = path == null || path.id.includes('/node_modules/') ? id : null

    return {
      path: normalizeRequestId(path?.id || id),
      external,
    }
  }

  private async resolveMocks() {
    await Promise.all(VitestMocker.pendingIds.map(async (mock) => {
      const { path, external } = await this.resolvePath(mock.id, mock.importer)
      if (mock.type === 'unmock')
        this.unmockPath(path)
      if (mock.type === 'mock')
        this.mockPath(path, external, mock.factory)
    }))

    VitestMocker.pendingIds = []
  }

  private async callFunctionMock(dep: string, mock: () => any) {
    const cached = this.moduleCache.get(dep)?.exports
    if (cached)
      return cached
    let exports: any
    try {
      exports = await mock()
    }
    catch (err) {
      const vitestError = new Error(
        '[vitest] There was an error, when mocking a module. '
      + 'If you are using vi.mock, make sure you are not using top level variables inside, since this call is hoisted. '
      + 'Read more: https://vitest.dev/api/#vi-mock')
      vitestError.cause = err
      throw vitestError
    }

    if (exports === null || typeof exports !== 'object')
      throw new Error('[vitest] vi.mock(path: string, factory?: () => unknown) is not returning an object. Did you mean to return an object with a "default" key?')

    this.moduleCache.set(dep, { exports })

    const filepath = dep.slice('mock:'.length)

    const exportHandler = {
      get(target: Record<string, any>, prop: any) {
        const val = target[prop]

        // 'then' can exist on non-Promise objects, need nested instanceof check for logic to work
        if (prop === 'then') {
          if (target instanceof Promise)
            return target.then.bind(target)
        }
        else if (!(prop in target)) {
          throw new Error(`[vitest] No "${prop}" export is defined on the "${filepath}"`)
        }

        return val
      },
    }

    return new Proxy(exports, exportHandler)
  }

  private getMockPath(dep: string) {
    return `mock:${dep}`
  }

  public getDependencyMock(id: string) {
    return this.getMocks()[id]
  }

  public normalizePath(path: string) {
    return pathFromRoot(this.root, normalizeRequestId(path, this.base))
  }

  public getFsPath(path: string, external: string | null) {
    if (external)
      return mergeSlashes(`/@fs/${path}`)

    return normalizeRequestId(path, this.base)
  }

  public resolveMockPath(mockPath: string, external: string | null) {
    const path = normalizeRequestId(external || mockPath)

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
    if (!VitestMocker.spyModule) {
      throw new Error(
        'Error: Spy module is not defined. '
        + 'This is likely an internal bug in Vitest. '
        + 'Please report it to https://github.com/vitest-dev/vitest/issues')
    }
    const spyModule = VitestMocker.spyModule

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
      for (const { key: property, descriptor } of getAllMockableProperties(container)) {
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
          spyModule.spyOn(newContainer, property).mockImplementation(() => undefined)
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

    const mockId = this.getMockPath(id)
    if (this.moduleCache.get(mockId))
      this.moduleCache.delete(mockId)
  }

  public mockPath(path: string, external: string | null, factory?: () => any) {
    const suitefile = this.getSuiteFilepath()
    const id = this.normalizePath(path)

    const mocks = this.mockMap.get(suitefile) || {}

    mocks[id] = factory || this.resolveMockPath(path, external)

    this.mockMap.set(suitefile, mocks)
  }

  public async importActual<T>(id: string, importer: string): Promise<T> {
    const { path, external } = await this.resolvePath(id, importer)
    const fsPath = this.getFsPath(path, external)
    const result = await this.request(fsPath)
    return result as T
  }

  public async importMock(id: string, importer: string): Promise<any> {
    const { path, external } = await this.resolvePath(id, importer)

    const fsPath = this.getFsPath(path, external)
    const normalizedId = this.normalizePath(fsPath)
    let mock = this.getDependencyMock(normalizedId)

    if (mock === undefined)
      mock = this.resolveMockPath(fsPath, external)

    if (mock === null) {
      await this.ensureSpy()
      const mod = await this.request(fsPath)
      return this.mockObject(mod)
    }

    if (typeof mock === 'function')
      return this.callFunctionMock(fsPath, mock)
    return this.requestWithMock(mock)
  }

  private async ensureSpy() {
    if (VitestMocker.spyModule)
      return
    VitestMocker.spyModule = await this.request(`/@fs/${slash(resolve(distDir, 'spy.js'))}`) as typeof import('../integrations/spy')
  }

  public async requestWithMock(dep: string) {
    await Promise.all([
      this.ensureSpy(),
      this.resolveMocks(),
    ])

    const id = this.normalizePath(dep)
    const mock = this.getDependencyMock(id)

    const callstack = this.request.callstack
    const mockPath = this.getMockPath(id)

    if (mock === null) {
      const cache = this.moduleCache.get(mockPath)
      if (cache?.exports)
        return cache.exports

      const exports = {}
      // Assign the empty exports object early to allow for cycles to work. The object will be filled by mockObject()
      this.moduleCache.set(mockPath, { exports })
      const mod = await this.request(dep)
      this.mockObject(mod, exports)
      return exports
    }
    if (typeof mock === 'function' && !callstack.includes(mockPath)) {
      callstack.push(mockPath)
      const result = await this.callFunctionMock(mockPath, mock)
      const indexMock = callstack.indexOf(mockPath)
      callstack.splice(indexMock, 1)
      return result
    }
    if (typeof mock === 'string' && !callstack.includes(mock))
      dep = mock
    return this.request(dep)
  }

  public queueMock(id: string, importer: string, factory?: () => unknown) {
    VitestMocker.pendingIds.push({ type: 'mock', id, importer, factory })
  }

  public queueUnmock(id: string, importer: string) {
    VitestMocker.pendingIds.push({ type: 'unmock', id, importer })
  }
}

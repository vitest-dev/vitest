import { existsSync, readdirSync } from 'fs'
import { isNodeBuiltin } from 'mlly'
import { basename, dirname, resolve } from 'pathe'
import { normalizeRequestId, toFilePath } from 'vite-node/utils'
import type { ModuleCacheMap } from 'vite-node/client'
import { getWorkerState, isWindows, mergeSlashes } from '../utils'
import { distDir } from '../constants'
import type { PendingSuiteMock } from '../types/mocker'
import type { ExecuteOptions } from './execute'

type Callback = (...args: any[]) => unknown

function getObjectType(value: unknown): string {
  return Object.prototype.toString.apply(value).slice(8, -1)
}

function mockPrototype(spyOn: typeof import('../integrations/jest-mock')['spyOn'], proto: any) {
  if (!proto) return null

  const newProto: any = {}

  const protoDescr = Object.getOwnPropertyDescriptors(proto)

  // eslint-disable-next-line no-restricted-syntax
  for (const d in protoDescr) {
    Object.defineProperty(newProto, d, protoDescr[d])

    if (typeof protoDescr[d].value === 'function')
      spyOn(newProto, d).mockImplementation(() => {})
  }

  return newProto
}

export class VitestMocker {
  private static pendingIds: PendingSuiteMock[] = []
  private static spyModule?: typeof import('../integrations/jest-mock')

  private request!: (dep: string) => unknown

  private root: string
  private callbacks: Record<string, ((...args: any[]) => unknown)[]> = {}

  constructor(
    public options: ExecuteOptions,
    private moduleCache: ModuleCacheMap,
    request?: (dep: string) => unknown,
  ) {
    this.root = this.options.root
    this.request = request!
  }

  get mockMap() {
    return this.options.mockMap
  }

  public on(event: string, cb: Callback) {
    this.callbacks[event] ??= []
    this.callbacks[event].push(cb)
  }

  private emit(event: string, ...args: any[]) {
    (this.callbacks[event] ?? []).forEach(fn => fn(...args))
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
    return {
      path: normalizeRequestId(path?.id || id),
      external: path?.id.includes('/node_modules/') ? id : null,
    }
  }

  private async resolveMocks() {
    await Promise.all(VitestMocker.pendingIds.map(async(mock) => {
      const { path, external } = await this.resolvePath(mock.id, mock.importer)
      if (mock.type === 'unmock')
        this.unmockPath(path)
      if (mock.type === 'mock')
        this.mockPath(path, external, mock.factory)
    }))

    VitestMocker.pendingIds = []
  }

  private async callFunctionMock(dep: string, mock: () => any) {
    const cacheName = `${dep}__mock`
    const cached = this.moduleCache.get(cacheName)?.exports
    if (cached)
      return cached
    const exports = await mock()
    this.emit('mocked', cacheName, { exports })
    return exports
  }

  public getDependencyMock(dep: string) {
    return this.getMocks()[this.resolveDependency(dep)]
  }

  public resolveDependency(dep: string) {
    return normalizeRequestId(dep).replace(/^\/@fs\//, isWindows ? '' : '/')
  }

  public normalizePath(path: string) {
    return normalizeRequestId(path.replace(this.root, '')).replace(/^\/@fs\//, isWindows ? '' : '/')
  }

  public getFsPath(path: string, external: string | null) {
    if (external)
      return mergeSlashes(`/@fs/${path}`)

    return normalizeRequestId(path.replace(this.root, ''))
  }

  public resolveMockPath(mockPath: string, external: string | null) {
    const path = normalizeRequestId(external || mockPath)

    // it's a node_module alias
    // all mocks should be inside <root>/__mocks__
    if (external || isNodeBuiltin(mockPath)) {
      const mockDirname = dirname(path) // for nested mocks: @vueuse/integration/useJwt
      const baseFilename = basename(path)
      const mockFolder = resolve(this.root, '__mocks__', mockDirname)

      if (!existsSync(mockFolder)) return null

      const files = readdirSync(mockFolder)

      for (const file of files) {
        const [basename] = file.split('.')
        if (basename === baseFilename)
          return resolve(mockFolder, file).replace(this.root, '')
      }

      return null
    }

    const dir = dirname(path)
    const baseId = basename(path)
    const fullPath = resolve(dir, '__mocks__', baseId)
    return existsSync(fullPath) ? fullPath.replace(this.root, '') : null
  }

  public mockObject(obj: any) {
    if (!VitestMocker.spyModule)
      throw new Error('Internal Vitest error: Spy function is not defined.')

    const type = getObjectType(obj)

    if (Array.isArray(obj))
      return []
    else if (type !== 'Object' && type !== 'Module')
      return obj

    const newObj = { ...obj }

    const proto = mockPrototype(VitestMocker.spyModule.spyOn, Object.getPrototypeOf(obj))
    Object.setPrototypeOf(newObj, proto)

    // eslint-disable-next-line no-restricted-syntax
    for (const k in obj) {
      newObj[k] = this.mockObject(obj[k])
      const type = getObjectType(obj[k])

      if (type.includes('Function') && !obj[k]._isMockFunction) {
        VitestMocker.spyModule.spyOn(newObj, k).mockImplementation(() => {})
        Object.defineProperty(newObj[k], 'length', { value: 0 }) // tinyspy retains length, but jest doesnt
      }
    }
    return newObj
  }

  public unmockPath(path: string) {
    const suitefile = this.getSuiteFilepath()

    const fsPath = this.normalizePath(path)

    const mock = this.mockMap.get(suitefile)
    if (mock?.[fsPath])
      delete mock[fsPath]
  }

  public mockPath(path: string, external: string | null, factory?: () => any) {
    const suitefile = this.getSuiteFilepath()

    const fsPath = this.normalizePath(path)

    if (!this.mockMap.has(suitefile))
      this.mockMap.set(suitefile, {})

    this.mockMap.get(suitefile)![fsPath] = factory || this.resolveMockPath(path, external)
  }

  public async importActual<T>(id: string, importer: string): Promise<T> {
    const { path, external } = await this.resolvePath(id, importer)
    const fsPath = this.getFsPath(path, external)
    const result = await this.request(fsPath)
    return result as T
  }

  public async importMock(id: string, importer: string): Promise<any> {
    const { path, external } = await this.resolvePath(id, importer)

    let mock = this.getDependencyMock(path)

    if (mock === undefined)
      mock = this.resolveMockPath(path, external)

    if (mock === null) {
      await this.ensureSpy()
      const fsPath = this.getFsPath(path, external)
      const mod = await this.request(fsPath)
      return this.mockObject(mod)
    }
    if (typeof mock === 'function')
      return this.callFunctionMock(path, mock)
    return this.requestWithMock(mock)
  }

  private async ensureSpy() {
    if (VitestMocker.spyModule) return
    VitestMocker.spyModule = await this.request(resolve(distDir, 'jest-mock.js')) as typeof import('../integrations/jest-mock')
  }

  public async requestWithMock(dep: string) {
    await this.ensureSpy()
    await this.resolveMocks()

    const mock = this.getDependencyMock(dep)

    if (mock === null) {
      const cacheName = `${dep}__mock`
      const cache = this.moduleCache.get(cacheName)
      if (cache?.exports)
        return cache.exports
      const cacheKey = toFilePath(dep, this.root)
      const mod = this.moduleCache.get(cacheKey)?.exports || await this.request(dep)
      const exports = this.mockObject(mod)
      this.emit('mocked', cacheName, { exports })
      return exports
    }
    if (typeof mock === 'function')
      return this.callFunctionMock(dep, mock)
    if (typeof mock === 'string')
      dep = mock
    return this.request(dep)
  }

  public queueMock(id: string, importer: string, factory?: () => unknown) {
    VitestMocker.pendingIds.push({ type: 'mock', id, importer, factory })
  }

  public queueUnmock(id: string, importer: string) {
    VitestMocker.pendingIds.push({ type: 'unmock', id, importer })
  }

  public withRequest(request: (dep: string) => unknown) {
    return new VitestMocker(this.options, this.moduleCache, request)
  }
}

import type { MockedModule, MockedModuleType } from '../registry'
import type { ModuleMockOptions } from '../types'
import type { ModuleMockerInterceptor } from './interceptor'
import { extname, join } from 'pathe'
import { mockObject } from '../automocker'
import { AutomockedModule, MockerRegistry, RedirectedModule } from '../registry'

const { now } = Date

export class ModuleMocker {
  protected registry: MockerRegistry = new MockerRegistry()

  private queue = new Set<Promise<void>>()
  private mockedIds = new Set<string>()

  constructor(
    private interceptor: ModuleMockerInterceptor,
    private rpc: ModuleMockerRPC,
    private spyOn: (obj: any, method: string | symbol) => any,
    private config: ModuleMockerConfig,
  ) {}

  public async prepare(): Promise<void> {
    if (!this.queue.size) {
      return
    }
    await Promise.all([...this.queue.values()])
  }

  public async resolveFactoryModule(id: string): Promise<Record<string | symbol, any>> {
    const mock = this.registry.get(id)
    if (!mock || mock.type !== 'manual') {
      throw new Error(`Mock ${id} wasn't registered. This is probably a Vitest error. Please, open a new issue with reproduction.`)
    }
    const result = await mock.resolve()
    return result
  }

  public getFactoryModule(id: string): any {
    const mock = this.registry.get(id)
    if (!mock || mock.type !== 'manual') {
      throw new Error(`Mock ${id} wasn't registered. This is probably a Vitest error. Please, open a new issue with reproduction.`)
    }
    if (!mock.cache) {
      throw new Error(`Mock ${id} wasn't resolved. This is probably a Vitest error. Please, open a new issue with reproduction.`)
    }
    return mock.cache
  }

  public async invalidate(): Promise<void> {
    const ids = Array.from(this.mockedIds)
    if (!ids.length) {
      return
    }
    await this.rpc.invalidate(ids)
    this.interceptor.invalidate()
    this.registry.clear()
  }

  public async importActual<T>(id: string, importer: string): Promise<T> {
    const resolved = await this.rpc.resolveId(id, importer)
    if (resolved == null) {
      throw new Error(
        `[vitest] Cannot resolve "${id}" imported from "${importer}"`,
      )
    }
    const ext = extname(resolved.id)
    const url = new URL(resolved.url, location.href)
    const query = `_vitest_original&ext${ext}`
    const actualUrl = `${url.pathname}${
      url.search ? `${url.search}&${query}` : `?${query}`
    }${url.hash}`
    return this.wrapDynamicImport(() => import(/* @vite-ignore */ actualUrl)).then((mod) => {
      if (!resolved.optimized || typeof mod.default === 'undefined') {
        return mod
      }
      // vite injects this helper for optimized modules, so we try to follow the same behavior
      const m = mod.default
      return m?.__esModule ? m : { ...((typeof m === 'object' && !Array.isArray(m)) || typeof m === 'function' ? m : {}), default: m }
    })
  }

  public async importMock<T>(rawId: string, importer: string): Promise<T> {
    await this.prepare()
    const { resolvedId, redirectUrl } = await this.rpc.resolveMock(
      rawId,
      importer,
      { mock: 'auto' },
    )

    const mockUrl = this.resolveMockPath(cleanVersion(resolvedId))
    let mock = this.registry.get(mockUrl)

    if (!mock) {
      if (redirectUrl) {
        const resolvedRedirect = new URL(this.resolveMockPath(cleanVersion(redirectUrl)), location.href).toString()
        mock = new RedirectedModule(rawId, mockUrl, resolvedRedirect)
      }
      else {
        mock = new AutomockedModule(rawId, mockUrl)
      }
    }

    if (mock.type === 'manual') {
      return await mock.resolve() as T
    }

    if (mock.type === 'automock' || mock.type === 'autospy') {
      const url = new URL(`/@id/${resolvedId}`, location.href)
      const query = url.search ? `${url.search}&t=${now()}` : `?t=${now()}`
      const moduleObject = await import(/* @vite-ignore */ `${url.pathname}${query}&mock=${mock.type}${url.hash}`)
      return this.mockObject(moduleObject, mock.type) as T
    }

    return import(/* @vite-ignore */ mock.redirect)
  }

  public mockObject(
    object: Record<string | symbol, any>,
    moduleType: MockedModuleType = 'automock',
  ): Record<string | symbol, any> {
    return mockObject({
      globalConstructors: {
        Object,
        Function,
        Array,
        Map,
        RegExp,
      },
      spyOn: this.spyOn,
      type: moduleType,
    }, object)
  }

  public queueMock(rawId: string, importer: string, factoryOrOptions?: ModuleMockOptions | (() => any)): void {
    const promise = this.rpc
      .resolveMock(rawId, importer, {
        mock: typeof factoryOrOptions === 'function'
          ? 'factory'
          : factoryOrOptions?.spy ? 'spy' : 'auto',
      })
      .then(async ({ redirectUrl, resolvedId, needsInterop, mockType }) => {
        const mockUrl = this.resolveMockPath(cleanVersion(resolvedId))
        this.mockedIds.add(resolvedId)
        const factory = typeof factoryOrOptions === 'function'
          ? async () => {
            const data = await factoryOrOptions()
            // vite wraps all external modules that have "needsInterop" in a function that
            // merges all exports from default into the module object
            return needsInterop ? { default: data } : data
          }
          : undefined

        const mockRedirect = typeof redirectUrl === 'string'
          ? new URL(this.resolveMockPath(cleanVersion(redirectUrl)), location.href).toString()
          : null

        let module: MockedModule
        if (mockType === 'manual') {
          module = this.registry.register('manual', rawId, mockUrl, factory!)
        }
        // autospy takes higher priority over redirect, so it needs to be checked first
        else if (mockType === 'autospy') {
          module = this.registry.register('autospy', rawId, mockUrl)
        }
        else if (mockType === 'redirect') {
          module = this.registry.register('redirect', rawId, mockUrl, mockRedirect!)
        }
        else {
          module = this.registry.register('automock', rawId, mockUrl)
        }

        await this.interceptor.register(module)
      })
      .finally(() => {
        this.queue.delete(promise)
      })
    this.queue.add(promise)
  }

  public queueUnmock(id: string, importer: string): void {
    const promise = this.rpc
      .resolveId(id, importer)
      .then(async (resolved) => {
        if (!resolved) {
          return
        }
        const mockUrl = this.resolveMockPath(cleanVersion(resolved.id))
        this.mockedIds.add(resolved.id)
        this.registry.delete(mockUrl)
        await this.interceptor.delete(mockUrl)
      })
      .finally(() => {
        this.queue.delete(promise)
      })
    this.queue.add(promise)
  }

  // We need to await mock registration before importing the actual module
  // In case there is a mocked module in the import chain
  public wrapDynamicImport<T>(moduleFactory: () => Promise<T>): Promise<T> {
    if (typeof moduleFactory === 'function') {
      const promise = new Promise<T>((resolve, reject) => {
        this.prepare().finally(() => {
          moduleFactory().then(resolve, reject)
        })
      })
      return promise
    }
    return moduleFactory
  }

  private resolveMockPath(path: string) {
    const config = this.config
    const fsRoot = join('/@fs/', config.root)

    // URL can be /file/path.js, but path is resolved to /file/path
    if (path.startsWith(config.root)) {
      return path.slice(config.root.length)
    }

    if (path.startsWith(fsRoot)) {
      return path.slice(fsRoot.length)
    }

    return path
  }
}

const versionRegexp = /(\?|&)v=\w{8}/
function cleanVersion(url: string) {
  return url.replace(versionRegexp, '')
}

export interface ResolveIdResult {
  id: string
  url: string
  optimized: boolean
}

export interface ResolveMockResult {
  mockType: MockedModuleType
  resolvedId: string
  redirectUrl?: string | null
  needsInterop?: boolean
}

export interface ModuleMockerRPC {
  invalidate: (ids: string[]) => Promise<void>
  resolveId: (id: string, importer: string) => Promise<ResolveIdResult | null>
  resolveMock: (
    id: string,
    importer: string,
    options: { mock: 'spy' | 'factory' | 'auto' }
  ) => Promise<ResolveMockResult>
}

export interface ModuleMockerConfig {
  root: string
}

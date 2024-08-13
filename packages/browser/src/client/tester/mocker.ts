import { extname, join } from 'pathe'
import type { IframeChannelOutgoingEvent, IframeMockEvent, IframeUnmockEvent } from '@vitest/browser/client'
import type { MockedModuleType } from 'vitest/mocker'
import { AutomockedModule, MockerRegistry, RedirectedModule, mockObject } from 'vitest/mocker'
import { channel, waitForChannel } from '@vitest/browser/client'
import { getBrowserState, importId } from '../utils'
import { rpc } from './rpc'

const now = Date.now

interface SpyModule {
  spyOn: typeof import('vitest').vi['spyOn']
}

export class VitestBrowserClientMocker {
  private queue = new Set<Promise<void>>()
  private registry = new MockerRegistry()
  private mockedIds = new Set<string>()

  private spyModule!: SpyModule

  setupWorker() {
    channel.addEventListener(
      'message',
      async (e: MessageEvent<IframeChannelOutgoingEvent>) => {
        if (e.data.type === 'mock-factory:request') {
          try {
            const module = await this.resolve(e.data.id)
            const exports = Object.keys(module)
            channel.postMessage({
              type: 'mock-factory:response',
              exports,
            })
          }
          catch (err: any) {
            const { processError } = (await importId(
              'vitest/browser',
            )) as typeof import('vitest/browser')
            channel.postMessage({
              type: 'mock-factory:error',
              error: processError(err),
            })
          }
        }
      },
    )
  }

  public setSpyModule(mod: SpyModule) {
    this.spyModule = mod
  }

  public async importActual(id: string, importer: string) {
    const resolved = await rpc().resolveId(id, importer)
    if (resolved == null) {
      throw new Error(
        `[vitest] Cannot resolve ${id} imported from ${importer}`,
      )
    }
    const ext = extname(resolved.id)
    const url = new URL(resolved.url, location.href)
    const query = `_vitest_original&ext${ext}`
    const actualUrl = `${url.pathname}${
      url.search ? `${url.search}&${query}` : `?${query}`
    }${url.hash}`
    return getBrowserState().wrapModule(() => import(/* @vite-ignore */ actualUrl)).then((mod) => {
      if (!resolved.optimized || typeof mod.default === 'undefined') {
        return mod
      }
      // vite injects this helper for optimized modules, so we try to follow the same behavior
      const m = mod.default
      return m?.__esModule ? m : { ...((typeof m === 'object' && !Array.isArray(m)) || typeof m === 'function' ? m : {}), default: m }
    })
  }

  public async importMock(rawId: string, importer: string) {
    await this.prepare()
    const { resolvedId, redirectUrl } = await rpc().resolveMock(
      rawId,
      importer,
      false,
    )

    const mockUrl = resolveMockPath(cleanVersion(resolvedId))
    let mock = this.registry.get(resolveMockPath(mockUrl))

    if (!mock) {
      if (redirectUrl) {
        const resolvedRedirect = new URL(resolvedMockedPath(cleanVersion(redirectUrl)), location.href).toString()
        mock = new RedirectedModule(rawId, mockUrl, resolvedRedirect)
      }
      else {
        mock = new AutomockedModule(rawId, mockUrl)
      }
    }

    if (mock.type === 'manual') {
      return await mock.resolve()
    }

    if (mock.type === 'automock' || mock.type === 'autospy') {
      const url = new URL(`/@id/${resolvedId}`, location.href)
      const query = url.search ? `${url.search}&t=${now()}` : `?t=${now()}`
      const moduleObject = await import(/* @vite-ignore */ `${url.pathname}${query}&mock=${mock.type}${url.hash}`)
      return this.mockObject(moduleObject, mock.type)
    }

    return import(/* @vite-ignore */ mock.redirect)
  }

  public getMockContext() {
    return { callstack: null }
  }

  public get(id: string) {
    const mock = this.registry.get(id)
    if (!mock || mock.type !== 'manual') {
      throw new Error(`Mock ${id} wasn't registered. This is probably a Vitest error. Please, open a new issue with reproduction.`)
    }
    if (!mock.cache) {
      throw new Error(`Mock ${id} wasn't resolved. This is probably a Vitest error. Please, open a new issue with reproduction.`)
    }
    return mock.cache
  }

  public async invalidate() {
    const ids = Array.from(this.mockedIds)
    if (!ids.length) {
      return
    }
    await rpc().invalidate(ids)
    channel.postMessage({ type: 'mock:invalidate' })
    this.registry.clear()
  }

  public async resolve(id: string) {
    const mock = this.registry.get(id)
    if (!mock || mock.type !== 'manual') {
      throw new Error(`Cannot resolve ${id} mock: no factory provided`)
    }
    return await mock.resolve()
  }

  public queueMock(rawId: string, importer: string, factoryOrOptions?: MockOptions | (() => any)) {
    const promise = rpc()
      .resolveMock(rawId, importer, typeof factoryOrOptions === 'function')
      .then(async ({ redirectUrl, resolvedId, needsInterop }) => {
        const mockUrl = resolveMockPath(cleanVersion(resolvedId))
        this.mockedIds.add(resolvedId)
        const factory = typeof factoryOrOptions === 'function'
          ? async () => {
            const data = await factoryOrOptions()
            return needsInterop ? { default: data } : data
          }
          : undefined

        const mockRedirect = typeof redirectUrl === 'string'
          ? new URL(resolvedMockedPath(cleanVersion(redirectUrl)), location.href).toString()
          : null
        const mockType = getMockBehaviour(factoryOrOptions, mockRedirect)

        if (mockType === 'manual') {
          this.registry.register('manual', rawId, mockUrl, factory!)
        }
        // autospy takes higher priority over redirect, so it needs to be checked first
        else if (mockType === 'autospy') {
          this.registry.register('autospy', rawId, mockUrl)
        }
        else if (mockType === 'redirect') {
          this.registry.register('redirect', rawId, mockUrl, mockRedirect!)
        }
        else {
          this.registry.register('automock', rawId, mockUrl)
        }

        await this.notifyMock(mockType, mockUrl, mockRedirect)
      })
      .finally(() => {
        this.queue.delete(promise)
      })
    this.queue.add(promise)
  }

  private notifyMock(mockType: MockedModuleType, mockUrl: string, mockRedirect?: string | null) {
    if (mockType === 'redirect') {
      return this.notifyMsw({
        type: 'mock',
        mockType,
        url: mockUrl,
        redirect: mockRedirect!,
      })
    }
    return this.notifyMsw({
      type: 'mock',
      mockType,
      url: mockUrl,
    })
  }

  private async notifyMsw(message: IframeMockEvent | IframeUnmockEvent) {
    channel.postMessage(message)
    await waitForChannel(`${message.type}:done`)
  }

  public queueUnmock(id: string, importer: string) {
    const promise = rpc()
      .resolveId(id, importer)
      .then(async (resolved) => {
        if (!resolved) {
          return
        }
        const mockUrl = resolveMockPath(cleanVersion(resolved.id))
        this.mockedIds.add(resolved.id)
        this.registry.delete(mockUrl)
        await this.notifyMsw({
          type: 'unmock',
          url: mockUrl,
        })
      })
      .finally(() => {
        this.queue.delete(promise)
      })
    this.queue.add(promise)
  }

  public async prepare() {
    if (!this.queue.size) {
      return
    }
    await Promise.all([...this.queue.values()])
  }

  public mockObject(
    object: Record<string | symbol, any>,
    moduleType: MockedModuleType = 'automock',
  ) {
    const spyOn = this.spyModule.spyOn
    if (!spyOn) {
      throw new Error(
        '[vitest] `spyModule` is not defined. This is a Vitest error. Please open a new issue with reproduction.',
      )
    }
    return mockObject({
      globalConstructors: {
        Object,
        Function,
        Array,
        Map,
        RegExp,
      },
      spyOn,
      type: moduleType,
    }, object)
  }
}

function resolvedMockedPath(path: string) {
  const config = getBrowserState().viteConfig
  if (path.startsWith(config.root)) {
    return path.slice(config.root.length)
  }
  return path
}

// TODO: check _base_ path
function resolveMockPath(path: string) {
  const config = getBrowserState().viteConfig
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

const versionRegexp = /(\?|&)v=\w{8}/
function cleanVersion(url: string) {
  return url.replace(versionRegexp, '')
}

export interface MockOptions {
  spy?: boolean
}

function getMockBehaviour(factoryOrOptions: undefined | (() => void) | MockOptions, mockRedirect: string | null): MockedModuleType {
  if (!factoryOrOptions) {
    return mockRedirect ? 'redirect' : 'automock'
  }
  if (typeof factoryOrOptions === 'function') {
    return 'manual'
  }
  if (factoryOrOptions.spy) {
    return 'autospy'
  }
  return mockRedirect ? 'redirect' : 'automock'
}

import { extname, join } from 'pathe'
import { rpc } from './rpc'
import { getBrowserState, importId } from './utils'
import { channel, waitForChannel } from './client'
import type { IframeChannelOutgoingEvent } from './channel'

const now = Date.now

export class VitestBrowserClientMocker {
  private queue = new Set<Promise<void>>()
  private mocks: Record<string, undefined | null | string> = {}
  private mockObjects: Record<string, any> = {}
  private factories: Record<string, () => any> = {}
  private ids = new Set<string>()

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

  public async importActual(id: string, importer: string) {
    const resolved = await rpc().resolveId(id, importer)
    if (resolved == null) {
      throw new Error(
        `[vitest] Cannot resolve ${id} imported from ${importer}`,
      )
    }
    const ext = extname(resolved.id)
    const url = new URL(`/@id/${resolved.id}`, location.href)
    const query = `_vitest_original&ext.${ext}`
    const actualUrl = `${url.pathname}${
      url.search ? `${url.search}&${query}` : `?${query}`
    }${url.hash}`
    return getBrowserState().wrapModule(() => import(actualUrl))
  }

  public async importMock(rawId: string, importer: string) {
    await this.prepare()
    const { resolvedId, type, mockPath } = await rpc().resolveMock(
      rawId,
      importer,
      false,
    )

    const factoryReturn = this.get(resolvedId)
    if (factoryReturn) {
      return factoryReturn
    }

    if (this.factories[resolvedId]) {
      return await this.resolve(resolvedId)
    }

    if (type === 'redirect') {
      const url = new URL(`/@id/${mockPath}`, location.href)
      return import(url.toString())
    }
    const url = new URL(`/@id/${resolvedId}`, location.href)
    const query = url.search ? `${url.search}&t=${now()}&mock=auto` : `?t=${now()}&mock=auto`
    return import(`${url.pathname}${query}${url.hash}`)
  }

  public getMockContext() {
    return { callstack: null }
  }

  public get(id: string) {
    return this.mockObjects[id]
  }

  public async invalidate() {
    const ids = Array.from(this.ids)
    if (!ids.length) {
      return
    }
    await rpc().invalidate(ids)
    channel.postMessage({ type: 'mock:invalidate' })
    this.ids.clear()
    this.mocks = {}
    this.mockObjects = {}
    this.factories = {}
  }

  public async resolve(id: string) {
    const factory = this.factories[id]
    if (!factory) {
      throw new Error(`Cannot resolve ${id} mock: no factory provided`)
    }
    try {
      this.mockObjects[id] = await factory()
      return this.mockObjects[id]
    }
    catch (err) {
      const vitestError = new Error(
        '[vitest] There was an error when mocking a module. '
        + 'If you are using "vi.mock" factory, make sure there are no top level variables inside, since this call is hoisted to top of the file. '
        + 'Read more: https://vitest.dev/api/vi.html#vi-mock',
      )
      vitestError.cause = err
      throw vitestError
    }
  }

  public queueMock(id: string, importer: string, factory?: () => any) {
    const promise = rpc()
      .resolveMock(id, importer, !!factory)
      .then(async ({ mockPath, resolvedId }) => {
        this.ids.add(resolvedId)
        const urlPaths = resolveMockPaths(resolvedId)
        const resolvedMock
          = typeof mockPath === 'string'
            ? new URL(resolvedMockedPath(mockPath), location.href).toString()
            : mockPath
        urlPaths.forEach((url) => {
          this.mocks[url] = resolvedMock
          this.factories[url] = factory!
        })
        channel.postMessage({
          type: 'mock',
          paths: urlPaths,
          mock: resolvedMock,
        })
        await waitForChannel('mock:done')
      })
      .finally(() => {
        this.queue.delete(promise)
      })
    this.queue.add(promise)
  }

  public queueUnmock(id: string, importer: string) {
    const promise = rpc()
      .resolveId(id, importer)
      .then(async (resolved) => {
        if (!resolved) {
          return
        }
        this.ids.delete(resolved.id)
        const urlPaths = resolveMockPaths(resolved.id)
        urlPaths.forEach((url) => {
          delete this.mocks[url]
          delete this.factories[url]
          delete this.mockObjects[url]
        })
        channel.postMessage({
          type: 'unmock',
          paths: urlPaths,
        })
        await waitForChannel('unmock:done')
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
}

function resolvedMockedPath(path: string) {
  const config = getBrowserState().viteConfig
  if (path.startsWith(config.root)) {
    return path.slice(config.root.length)
  }
  return path
}

// TODO: check _base_ path
function resolveMockPaths(path: string) {
  const config = getBrowserState().viteConfig
  const fsRoot = join('/@fs/', config.root)
  const paths = [path, join('/@fs/', path)]

  // URL can be /file/path.js, but path is resolved to /file/path
  if (path.startsWith(config.root)) {
    paths.push(path.slice(config.root.length))
  }

  if (path.startsWith(fsRoot)) {
    paths.push(path.slice(fsRoot.length))
  }

  return paths
}

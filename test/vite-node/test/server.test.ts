import { join, resolve } from 'pathe'
import { ViteNodeServer } from 'vite-node/server'
import { describe, expect, test, vi } from 'vitest'
import { type Plugin, type ViteDevServer, createServer } from 'vite'
import { extractSourceMap } from '../../../packages/vite-node/src/source-map'

describe('server works correctly', async () => {
  test('resolve id considers transform mode', async () => {
    const resolveId = vi.fn()

    const vnServer = new ViteNodeServer({
      pluginContainer: { resolveId },
      config: {
        root: '/',
      },
      moduleGraph: {
        idToModuleMap: new Map(),
      },
    } as any, {
      transformMode: {
        web: [/web/],
        ssr: [/ssr/],
      },
    })

    await vnServer.resolveId('/path', '/web path')
    expect(resolveId).toHaveBeenCalledWith('/path', '/web path', { ssr: false })

    await vnServer.resolveId('/ssr', '/ssr path')
    expect(resolveId).toHaveBeenCalledWith('/ssr', '/ssr path', { ssr: true })
  })
})

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('server correctly caches data', () => {
  const it = test.extend<{
    root: string
    plugin: Plugin
    ssrFiles: string[]
    webFiles: string[]
    server: ViteDevServer
    viteNode: ViteNodeServer
  }>({
    ssrFiles: async ({}, use) => {
      await use([])
    },
    webFiles: async ({}, use) => {
      await use([])
    },
    root: resolve(__dirname, '../'),
    plugin: async ({ ssrFiles, webFiles }, use) => {
      const plugin: Plugin = {
        name: 'test',
        transform(code, id, options) {
          // this should be called only once if cached is configured correctly
          if (options?.ssr)
            ssrFiles.push(id)
          else
            webFiles.push(id)
        },
      }
      await use(plugin)
    },
    server: async ({ root, plugin }, use) => {
      const server = await createServer({
        configFile: false,
        root,
        server: {
          middlewareMode: true,
          watch: null,
        },
        optimizeDeps: {
          disabled: true,
        },
        plugins: [plugin],
      })
      await use(server)
      await server.close()
    },
    viteNode: async ({ server }, use) => {
      const vnServer = new ViteNodeServer(server)
      await use(vnServer)
    },
  })

  it('fetchModule with id, and got sourcemap source in absolute path', async ({ viteNode }) => {
    const fetchResult = await viteNode.fetchModule('/src/foo.js')

    const sourceMap = extractSourceMap(fetchResult.code!)

    // expect got sourcemap source in a valid filesystem path
    expect(sourceMap?.sources[0]).toBe('foo.js')
  })

  it('correctly returns cached and invalidated ssr modules', async ({ root, viteNode, ssrFiles, webFiles, server }) => {
    await viteNode.fetchModule('/src/foo.js', 'ssr')

    const fsPath = join(root, './src/foo.js')

    expect(viteNode.fetchCaches.web.has(fsPath)).toBe(false)
    expect(viteNode.fetchCache.has(fsPath)).toBe(true)
    expect(viteNode.fetchCaches.ssr.has(fsPath)).toBe(true)

    expect(webFiles).toHaveLength(0)
    expect(ssrFiles).toHaveLength(1)
    expect(ssrFiles).toContain(fsPath)

    await viteNode.fetchModule('/src/foo.js', 'ssr')

    expect(ssrFiles).toHaveLength(1)

    server.moduleGraph.invalidateModule(
      server.moduleGraph.getModuleById(fsPath)!,
      new Set(),
      Date.now(),
      false,
    )

    // wait so TS are different
    await wait(10)

    await viteNode.fetchModule('/src/foo.js', 'ssr')

    expect(ssrFiles).toHaveLength(2)

    // another fetch after invalidation returns cached result
    await viteNode.fetchModule('/src/foo.js', 'ssr')

    expect(ssrFiles).toHaveLength(2)

    server.moduleGraph.invalidateModule(
      server.moduleGraph.getModuleById(fsPath)!,
      new Set(),
      Date.now(),
      true,
    )

    // wait so TS are different
    await wait(10)

    await viteNode.fetchModule('/src/foo.js', 'ssr')

    expect(ssrFiles).toHaveLength(3)

    // another fetch after invalidation returns cached result
    await viteNode.fetchModule('/src/foo.js', 'ssr')

    expect(ssrFiles).toHaveLength(3)
    expect(webFiles).toHaveLength(0)
  })

  it('correctly returns cached and invalidated web modules', async ({ root, viteNode, webFiles, ssrFiles, server }) => {
    await viteNode.fetchModule('/src/foo.js', 'web')

    const fsPath = join(root, './src/foo.js')

    expect(viteNode.fetchCaches.ssr.has(fsPath)).toBe(false)
    expect(viteNode.fetchCache.has(fsPath)).toBe(true)
    expect(viteNode.fetchCaches.web.has(fsPath)).toBe(true)

    expect(ssrFiles).toHaveLength(0)
    expect(webFiles).toHaveLength(1)
    expect(webFiles).toContain(fsPath)

    await viteNode.fetchModule('/src/foo.js', 'web')

    expect(webFiles).toHaveLength(1)

    server.moduleGraph.invalidateModule(
      server.moduleGraph.getModuleById(fsPath)!,
      new Set(),
      Date.now(),
      false,
    )

    // wait so TS are different
    await wait(10)

    await viteNode.fetchModule('/src/foo.js', 'web')

    expect(webFiles).toHaveLength(2)

    // another fetch after invalidation returns cached result
    await viteNode.fetchModule('/src/foo.js', 'web')

    expect(webFiles).toHaveLength(2)

    server.moduleGraph.invalidateModule(
      server.moduleGraph.getModuleById(fsPath)!,
      new Set(),
      Date.now(),
      true,
    )

    // wait so TS are different
    await wait(10)

    await viteNode.fetchModule('/src/foo.js', 'web')

    expect(webFiles).toHaveLength(3)

    // another fetch after invalidation returns cached result
    await viteNode.fetchModule('/src/foo.js', 'web')

    expect(webFiles).toHaveLength(3)
    expect(ssrFiles).toHaveLength(0)
  })

  it('correctly processes the same file with both transform modes', async ({ viteNode, ssrFiles, webFiles, root }) => {
    await viteNode.fetchModule('/src/foo.js', 'ssr')
    await viteNode.fetchModule('/src/foo.js', 'web')

    const fsPath = join(root, './src/foo.js')

    expect(viteNode.fetchCaches.ssr.has(fsPath)).toBe(true)
    expect(viteNode.fetchCache.has(fsPath)).toBe(true)
    expect(viteNode.fetchCaches.web.has(fsPath)).toBe(true)

    expect(ssrFiles).toHaveLength(1)
    expect(webFiles).toHaveLength(1)

    await viteNode.fetchModule('/src/foo.js', 'ssr')
    await viteNode.fetchModule('/src/foo.js', 'web')

    expect(ssrFiles).toHaveLength(1)
    expect(webFiles).toHaveLength(1)
  })
})

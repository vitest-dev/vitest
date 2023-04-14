import { resolve } from 'pathe'
import { ViteNodeServer } from 'vite-node/server'
import { describe, expect, test, vi } from 'vitest'
import { createServer } from 'vite'
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
  test('fetchModule with id, and got sourcemap source in absolute path', async () => {
    const server = await createServer({
      logLevel: 'error',
      root: resolve(__dirname, '../'),
    })
    const vnServer = new ViteNodeServer(server)

    // fetchModule in not a valid filesystem path
    const fetchResult = await vnServer.fetchModule('/src/foo.js')

    const sourceMap = extractSourceMap(fetchResult.code!)

    // expect got sourcemap source in a valid filesystem path
    expect(sourceMap?.sources[0]).toBe('foo.js')
  })
})

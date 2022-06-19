import type { ViteDevServer } from 'vite'
import { ViteNodeServer } from 'vite-node/server'
import { describe, expect, test, vi } from 'vitest'

const mockDevServer = (options: any = {}) => {
  return options as ViteDevServer
}

describe('server works correctly', async () => {
  test('resolve id considers transform mode', async () => {
    const resolveId = vi.fn()

    const vnServer = new ViteNodeServer(mockDevServer({
      pluginContainer: { resolveId },
      config: {},
    }), {
      transformMode: {
        web: [/web/],
        ssr: [/ssr/],
      },
    })

    await vnServer.resolveId('/web path')
    expect(resolveId).toHaveBeenCalledWith('/web path', undefined, { ssr: false })

    await vnServer.resolveId('/ssr path')
    expect(resolveId).toHaveBeenCalledWith('/ssr path', undefined, { ssr: true })
  })
})

import type { Plugin, ViteDevServer } from 'vite'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { resolve } from 'pathe'
import { automockPlugin, type AutomockPluginOptions } from './automockPlugin'
import { dynamicImportPlugin } from './dynamicImportPlugin'
import { hoistMocksPlugin, type HoistMocksPluginOptions } from './hoistMocksPlugin'
import { interceptorPlugin } from './interceptorPlugin'
import { ServerMockResolver } from './resolver'

interface MockerPluginOptions extends AutomockPluginOptions {
  hoistMocks?: HoistMocksPluginOptions
}

// this is an implementation for public usage
// vitest doesn't use this plugin directly

export function mockerPlugin(options: MockerPluginOptions = {}): Plugin[] {
  let server: ViteDevServer
  const registerPath = resolve(fileURLToPath(new URL('./register.js', import.meta.url)))
  return [
    {
      name: 'vitest:mocker:ws-rpc',
      config(_, { command }) {
        if (command !== 'serve') {
          return
        }
        return {
          server: {
            // don't pre-transform request because they might be mocked at runtime
            preTransformRequests: false,
          },
          optimizeDeps: {
            exclude: ['@vitest/mocker/register', '@vitest/mocker/browser'],
          },
        }
      },
      configureServer(server_) {
        server = server_
        const mockResolver = new ServerMockResolver(server)
        server.ws.on('vitest:mocks:resolveId', async ({ id, importer }: { id: string; importer: string }) => {
          const resolved = await mockResolver.resolveId(id, importer)
          server.ws.send('vitest:mocks:resolvedId:result', resolved)
        })
        server.ws.on('vitest:mocks:resolveMock', async ({ id, importer, options }: { id: string; importer: string; options: any }) => {
          const resolved = await mockResolver.resolveMock(id, importer, options)
          server.ws.send('vitest:mocks:resolveMock:result', resolved)
        })
        server.ws.on('vitest:mocks:invalidate', async ({ ids }: { ids: string[] }) => {
          mockResolver.invalidate(ids)
          server.ws.send('vitest:mocks:invalidate:result')
        })
      },
      async load(id) {
        if (id !== registerPath) {
          return
        }

        if (!server) {
          // mocker doesn't work during build
          return 'export {}'
        }

        const content = await readFile(registerPath, 'utf-8')
        const result = content
          .replace(
            /__VITEST_GLOBAL_THIS_ACCESSOR__/g,
            options.globalThisAccessor ?? '"__vitest_mocker__"',
          )
          .replace(
            '__VITEST_MOCKER_ROOT__',
            JSON.stringify(server.config.root),
          )
        return result
      },
    },
    hoistMocksPlugin(options.hoistMocks),
    interceptorPlugin(options),
    automockPlugin(options),
    dynamicImportPlugin(options),
  ]
}

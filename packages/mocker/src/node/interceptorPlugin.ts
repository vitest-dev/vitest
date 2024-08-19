import { join } from 'node:path/posix'
import type { Plugin } from 'vite'
import type { MockedModuleSerialized } from '../registry'
import { ManualMockedModule, MockerRegistry } from '../registry'
import { cleanUrl } from '../utils'

export interface InterceptorPluginOptions {
  /**
   * @default "__vitest_mocker__"
   */
  globalThisAccessor?: string
}

export function interceptorPlugin(options: InterceptorPluginOptions): Plugin {
  const registry = new MockerRegistry()
  return {
    name: 'vitest:mocks:interceptor',
    enforce: 'pre',
    async load(id) {
      const mock = registry.get(id)
      if (!mock) {
        return
      }
      if (mock.type === 'manual') {
        const exports = Object.keys(await mock.resolve())
        const accessor = options.globalThisAccessor || '"__vitest_mocker__"'
        const serverUrl = (mock as any).serverUrl as string
        const module = `const module = globalThis[${accessor}].getFactoryModule("${serverUrl}");`
        const keys = exports
          .map((name) => {
            if (name === 'default') {
              return `export default module["default"];`
            }
            return `export const ${name} = module["${name}"];`
          })
          .join('\n')
        return `${module}\n${keys}`
      }
    },
    async resolveId(id, importer) {
      const resolved = await this.resolve(id, importer)
      if (!resolved) {
        return
      }
      const mock = registry.get(resolved.id)
      if (!mock) {
        return
      }
      if (mock.type === 'redirect') {
        return mock.redirect
      }
      if (mock.type === 'automock' || mock.type === 'autospy') {
        // handled by automockPlugin
        return injectQuery(resolved.id, `mock=${mock.type}`)
      }
    },
    configureServer(server) {
      server.ws.on('vitest:interceptor:register', (event: MockedModuleSerialized) => {
        const serverUrl = event.url
        event.url = join(server.config.root, event.url)
        if (event.type === 'manual') {
          const module = ManualMockedModule.fromJSON(event, async () => {
            const keys = await getFactoryExports(serverUrl)
            return Object.fromEntries(keys.map(key => [key, null]))
          })
          Object.assign(module, {
            // the browsers stores the url relative to the root
            // but on the server "id" operates on the file paths
            serverUrl,
          })
          registry.add(module)
        }
        else {
          registry.register(event)
        }
        server.ws.send('vitest:interceptor:register:result')
      })
      server.ws.on('vitest:interceptor:delete', (id: string) => {
        registry.delete(id)
        server.ws.send('vitest:interceptor:register:delete')
      })
      server.ws.on('vitest:interceptor:invalidate', () => {
        registry.clear()
        server.ws.send('vitest:interceptor:register:invalidate')
      })

      function getFactoryExports(url: string) {
        server.ws.send('vitest:interceptor:resolve', url)
        let timeout: NodeJS.Timeout
        return new Promise<string[]>((resolve, reject) => {
          timeout = setTimeout(() => {
            reject(new Error(`Timeout while waiting for factory exports of ${url}`))
          }, 10_000)
          server.ws.on('vitest:interceptor:resolved', ({ url: resolvedUrl, keys }: { url: string; keys: string[] }) => {
            if (resolvedUrl === url) {
              clearTimeout(timeout)
              resolve(keys)
            }
          })
        })
      }
    },
  }
}

const replacePercentageRE = /%/g
function injectQuery(url: string, queryToInject: string): string {
  // encode percents for consistent behavior with pathToFileURL
  // see #2614 for details
  const resolvedUrl = new URL(
    url.replace(replacePercentageRE, '%25'),
    location.href,
  )
  const { search, hash } = resolvedUrl
  const pathname = cleanUrl(url)
  return `${pathname}?${queryToInject}${search ? `&${search.slice(1)}` : ''}${
    hash ?? ''
  }`
}

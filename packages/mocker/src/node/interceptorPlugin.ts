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
        const module = `const module = globalThis[${options.globalThisAccessor || '"__vitest_mocker__"'}].getFactoryModule("${mock.url}");`
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
        if (event.type === 'manual') {
          const module = ManualMockedModule.fromJSON(event, async () => {
            const keys = await getFactoryExports(event.url)
            return Object.fromEntries(keys.map(key => [key, null]))
          })
          registry.set(module.url, module)
        }
        else {
          registry.register(event)
        }
      })
      server.ws.on('vitest:interceptor:delete', (id: string) => {
        registry.delete(id)
      })
      server.ws.on('vitest:interceptor:invalidate', () => {
        registry.clear()
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

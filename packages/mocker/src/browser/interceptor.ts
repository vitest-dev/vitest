import type { StartOptions } from 'msw/browser'
import type { ManualMockedModule, MockedModule } from '../registry'
import { MockerRegistry } from '../registry'
import { cleanUrl } from '../utils'

export interface ModuleMockerInterceptor {
  register: (module: MockedModule) => Promise<void>
  delete: (url: string) => Promise<void>
  invalidate: () => void
}

export interface ModuleMockerMSWInterceptorOptions {
  /**
   * The identifier to access the globalThis object in the worker.
   * This will be injected into the script as is, so make sure it's a valid JS expression.
   * @example
   * ```js
   * // globalThisAccessor: '__my_variable__' produces:
   * globalThis[__my_variable__]
   * // globalThisAccessor: 'Symbol.for('secret:mocks')' produces:
   * globalThis[Symbol.for('secret:mocks')]
   * // globalThisAccessor: '"__vitest_mocker__"' (notice quotes) produces:
   * globalThis["__vitest_mocker__"]
   * ```
   * @default `"__vitest_mocker__"`
   */
  globalThisAccessor?: string
  /**
   * Options passed down to `msw.setupWorker().start(options)`
   * @default { serviceWorker: { url: "/__vitest_msw__" }, quiet: true }
   */
  mswOptions?: StartOptions
}

export class ModuleMockerMSWInterceptor implements ModuleMockerInterceptor {
  private readonly mocks = new MockerRegistry()

  private started = false
  private startPromise: undefined | Promise<unknown>

  constructor(
    private readonly options: ModuleMockerMSWInterceptorOptions = {},
  ) {
    if (!options.globalThisAccessor) {
      options.globalThisAccessor = '"__vitest_mocker__"'
    }
    if (!options.mswOptions) {
      options.mswOptions = {}
    }
    if (!options.mswOptions.serviceWorker?.url) {
      options.mswOptions.serviceWorker ??= {}
      options.mswOptions.serviceWorker.url = '/__vitest_msw__'
    }
    options.mswOptions.quiet ??= true
  }

  async register(module: MockedModule): Promise<void> {
    await this.init()
    this.mocks.set(module.url, module)
  }

  async delete(url: string): Promise<void> {
    await this.init()
    this.mocks.delete(url)
  }

  invalidate(): void {
    this.mocks.clear()
  }

  private async resolveManualMock(mock: ManualMockedModule) {
    const exports = Object.keys(await mock.resolve())
    const module = `const module = globalThis[${this.options.globalThisAccessor!}].getFactoryModule("${mock.url}");`
    const keys = exports
      .map((name) => {
        if (name === 'default') {
          return `export default module["default"];`
        }
        return `export const ${name} = module["${name}"];`
      })
      .join('\n')
    const text = `${module}\n${keys}`
    return new Response(text, {
      headers: {
        'Content-Type': 'application/javascript',
      },
    })
  }

  private async init(): Promise<unknown> {
    if (this.started) {
      return
    }
    if (this.startPromise) {
      return this.startPromise
    }
    this.startPromise = Promise.all([
      import('msw/browser'),
      import('msw/core/http'),
    ]).then(([{ setupWorker }, { http }]) => {
      const worker = setupWorker(
        http.get(/.+/, async ({ request }) => {
          const path = cleanQuery(request.url.slice(location.origin.length))
          if (!this.mocks.has(path)) {
            // do not cache deps like Vite does for performance
            // because we want to be able to update mocks without restarting the server
            // TODO: check if it's still neded - we invalidate modules after each test
            if (path.includes('/deps/')) {
              return fetch(bypass(request))
            }

            return passthrough()
          }

          const mock = this.mocks.get(path)!

          switch (mock.type) {
            case 'manual':
              return this.resolveManualMock(mock)
            case 'automock':
            case 'autospy':
              return Response.redirect(injectQuery(path, `mock=${mock.type}`))
            case 'redirect':
              return Response.redirect(mock.redirect)
            default:
              throw new Error(`Unknown mock type: ${(mock as any).type}`)
          }
        }),
      )
      return worker.start(this.options.mswOptions)
    })
      .finally(() => {
        this.started = true
        this.startPromise = undefined
      })
    await this.startPromise
  }
}

const timestampRegexp = /(\?|&)t=\d{13}/
const versionRegexp = /(\?|&)v=\w{8}/
function cleanQuery(url: string) {
  return url.replace(timestampRegexp, '').replace(versionRegexp, '')
}

function passthrough() {
  return new Response(null, {
    status: 302,
    statusText: 'Passthrough',
    headers: {
      'x-msw-intention': 'passthrough',
    },
  })
}

function bypass(request: Request) {
  const clonedRequest = request.clone()
  clonedRequest.headers.set('x-msw-intention', 'bypass')
  const cacheControl = clonedRequest.headers.get('cache-control')
  if (cacheControl) {
    clonedRequest.headers.set(
      'cache-control',
      // allow reinvalidation of the cache so mocks can be updated
      cacheControl.replace(', immutable', ''),
    )
  }
  return clonedRequest
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

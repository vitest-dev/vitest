import type { StartOptions } from 'msw/browser'
import { type MockedModule, MockerRegistry } from '../registry'

export interface ModuleMockerInterceptor {
  register: (module: MockedModule) => Promise<void>
  delete: (url: string) => Promise<void>
  invalidate: () => void
}

export interface ModuleMockerMSWInterceptorOptions {
  /**
   * @default `"__vitest_mocker__"`
   */
  globalThisAccessor?: string
  /**
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
            if (path.includes('/deps/')) {
              return fetch(bypass(request))
            }

            return passthrough()
          }

          const mock = this.mocks.get(path)!

          // using a factory
          if (mock.type === 'manual') {
            const exports = Object.keys(await mock.resolve())
            const module = `const module = globalThis[${this.options.globalThisAccessor!}].getFactoryModule('${mock.url}');`
            const keys = exports
              .map((name) => {
                if (name === 'default') {
                  return `export default module['default'];`
                }
                return `export const ${name} = module['${name}'];`
              })
              .join('\n')
            const text = `${module}\n${keys}`
            return new Response(text, {
              headers: {
                'Content-Type': 'application/javascript',
              },
            })
          }

          if (mock.type === 'automock' || mock.type === 'autospy') {
            return Response.redirect(injectQuery(path, `mock=${mock.type}`))
          }

          if (mock.type === 'redirect') {
            return Response.redirect(mock.redirect)
          }

          throw new Error(`Unknown mock type: ${(mock as any).type}`)
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
}

export type MockEvent = ManualMockEvent | AutomockEvent | RedirectMockEvent

export interface ManualMockEvent {
  type: 'manual'
  rawId: string
  url: string
  factory: () => any
}

export interface AutomockEvent {
  type: 'automock' | 'autospy'
  rawId: string
  url: string
}

export interface RedirectMockEvent {
  type: 'redirect'
  rawId: string
  url: string
  redirect: string
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

const postfixRE = /[?#].*$/
function cleanUrl(url: string): string {
  return url.replace(postfixRE, '')
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

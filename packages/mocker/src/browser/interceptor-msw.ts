import type { HttpHandler } from 'msw'
import type { SetupWorker, StartOptions } from 'msw/browser'
import type { ManualMockedModule, MockedModule } from '../registry'
import type { ModuleMockerInterceptor } from './interceptor'
import { MockerRegistry } from '../registry'
import { cleanUrl } from '../utils'

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
   */
  mswOptions?: StartOptions
  /**
   * A pre-configured `msw.setupWorker` instance.
   */
  mswWorker?: SetupWorker
}

export class ModuleMockerMSWInterceptor implements ModuleMockerInterceptor {
  protected readonly mocks: MockerRegistry = new MockerRegistry()

  private startPromise: undefined | Promise<SetupWorker>
  private worker: undefined | SetupWorker

  constructor(
    private readonly options: ModuleMockerMSWInterceptorOptions = {},
  ) {
    if (!options.globalThisAccessor) {
      options.globalThisAccessor = '"__vitest_mocker__"'
    }
  }

  async register(module: MockedModule): Promise<void> {
    await this.init()
    this.mocks.add(module)
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

  protected async init(): Promise<SetupWorker> {
    if (this.worker) {
      return this.worker
    }
    if (this.startPromise) {
      return this.startPromise
    }
    const worker = this.options.mswWorker
    this.startPromise = Promise.all([
      worker
        ? {
            setupWorker(handler: HttpHandler) {
              worker.use(handler)
              return worker
            },
          }
        : import('msw/browser'),
      import('msw/core/http'),
    ]).then(([{ setupWorker }, { http }]) => {
      const worker = setupWorker(
        http.get(/.+/, async ({ request }) => {
          const path = cleanQuery(request.url.slice(location.origin.length))
          if (!this.mocks.has(path)) {
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
      return worker.start(this.options.mswOptions).then(() => worker)
    }).finally(() => {
      this.worker = worker
      this.startPromise = undefined
    })
    return await this.startPromise
  }
}

const trailingSeparatorRE = /[?&]$/
const timestampRE = /\bt=\d{13}&?\b/
const versionRE = /\bv=\w{8}&?\b/
function cleanQuery(url: string) {
  return url.replace(timestampRE, '').replace(versionRE, '').replace(trailingSeparatorRE, '')
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

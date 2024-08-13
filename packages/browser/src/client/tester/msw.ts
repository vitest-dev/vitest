import { channel } from '@vitest/browser/client'
import type {
  IframeChannelEvent,
  IframeMockEvent,
  IframeMockingDoneEvent,
  IframeUnmockEvent,
} from '@vitest/browser/client'
import { MockerRegistry } from 'vitest/mocker'

export function createModuleMocker() {
  const mocks = new MockerRegistry()

  let started = false
  let startPromise: undefined | Promise<unknown>

  async function init() {
    if (started) {
      return
    }
    if (startPromise) {
      return startPromise
    }
    startPromise = Promise.all([
      import('msw/browser'),
      import('msw/core/http'),
    ]).then(([{ setupWorker }, { http }]) => {
      const worker = setupWorker(
        http.get(/.+/, async ({ request }) => {
          const path = cleanQuery(request.url.slice(location.origin.length))
          if (!mocks.has(path)) {
            if (path.includes('/deps/')) {
              return fetch(bypass(request))
            }

            return passthrough()
          }

          const mock = mocks.get(path)!

          // using a factory
          if (mock.type === 'manual') {
            const exports = await mock.resolve() as { keys: string[] }
            const module = `const module = __vitest_mocker__.get('${mock.url}');`
            const keys = exports.keys
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
      return worker.start({
        serviceWorker: {
          url: '/__vitest_msw__',
        },
        quiet: true,
      })
    })
      .finally(() => {
        started = true
        startPromise = undefined
      })
    await startPromise
  }

  return {
    async mock(event: IframeMockEvent) {
      await init()
      if (event.mockType === 'manual') {
        mocks.register('manual', event.url, event.url, async () => {
          const keys = await getFactoryExports(event.url)
          return { keys }
        })
      }
      else if (event.mockType === 'automock' || event.mockType === 'autospy') {
        mocks.register(event.mockType, event.url, event.url)
      }
      else {
        mocks.register('redirect', event.url, event.url, event.redirect)
      }
      channel.postMessage(<IframeMockingDoneEvent>{ type: 'mock:done' })
    },
    async unmock(event: IframeUnmockEvent) {
      await init()
      mocks.delete(event.url)
      channel.postMessage(<IframeMockingDoneEvent>{ type: 'unmock:done' })
    },
    invalidate() {
      mocks.clear()
    },
  }
}

function getFactoryExports(id: string) {
  channel.postMessage({
    type: 'mock-factory:request',
    id,
  })
  return new Promise<string[]>((resolve, reject) => {
    channel.addEventListener(
      'message',
      function onMessage(e: MessageEvent<IframeChannelEvent>) {
        if (e.data.type === 'mock-factory:response') {
          resolve(e.data.exports)
          channel.removeEventListener('message', onMessage)
        }
        if (e.data.type === 'mock-factory:error') {
          reject(e.data.error)
          channel.removeEventListener('message', onMessage)
        }
      },
    )
  })
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

import { channel } from '@vitest/browser/client'
import type {
  IframeChannelEvent,
  IframeMockEvent,
  IframeMockingDoneEvent,
  IframeUnmockEvent,
} from '@vitest/browser/client'

export function createModuleMocker() {
  const mocks: Map<string, string | null | undefined> = new Map()

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
            return passthrough()
          }

          const mock = mocks.get(path)

          // using a factory
          if (mock === undefined) {
            const exports = await getFactoryExports(path)
            const module = `const module = __vitest_mocker__.get('${path}');`
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

          if (typeof mock === 'string') {
            return Response.redirect(mock)
          }

          return Response.redirect(injectQuery(path, 'mock=auto'))
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
      event.paths.forEach(path => mocks.set(path, event.mock))
      channel.postMessage(<IframeMockingDoneEvent>{ type: 'mock:done' })
    },
    async unmock(event: IframeUnmockEvent) {
      await init()
      event.paths.forEach(path => mocks.delete(path))
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

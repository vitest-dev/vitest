import { http } from 'msw/core/http'
import { setupWorker } from 'msw/browser'
import type {
  IframeChannelEvent,
  IframeMockEvent,
  IframeMockingDoneEvent,
  IframeUnmockEvent,
} from './channel'
import { channel } from './channel'
import { client } from './client'

export function createModuleMocker() {
  const mocks: Map<string, string | null | undefined> = new Map()

  const worker = setupWorker(
    http.get(/.+/, async ({ request }) => {
      const path = removeTimestamp(request.url.slice(location.origin.length))
      if (!mocks.has(path)) {
        return passthrough()
      }

      const mock = mocks.get(path)

      // using a factory
      if (mock === undefined) {
        // TODO: check how the error looks
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

      const content = await client.rpc.automock(path)
      return new Response(content, {
        headers: {
          'Content-Type': 'application/javascript',
        },
      })
    }),
  )

  let started = false
  let startPromise: undefined | Promise<unknown>

  async function init() {
    if (started) {
      return
    }
    if (startPromise) {
      return startPromise
    }
    startPromise = worker
      .start({
        serviceWorker: {
          url: '/__virtual_vitest__:mocker-worker.js',
        },
        quiet: true,
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

function removeTimestamp(url: string) {
  return url.replace(timestampRegexp, '')
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

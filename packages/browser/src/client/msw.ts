import { http } from 'msw/core/http'
import { setupWorker } from 'msw/browser'
import { rpc } from './rpc'
import type { IframeChannelEvent, IframeChannelIncomingEvent } from './channel'
import { channel } from './channel'

export async function createModuleMocker() {
  const mocks: Record<string, string | null | undefined> = {}

  channel.addEventListener('message', (e: MessageEvent<IframeChannelIncomingEvent>) => {
    switch (e.data.type) {
      case 'mock':
        for (const path of e.data.paths)
          mocks[path] = e.data.mock
        break
      case 'unmock':
        for (const path of e.data.paths)
          delete mocks[path]
        break
    }
  })

  const worker = setupWorker(
    http.get(/.+/, async ({ request }) => {
      const path = removeTimestamp(request.url.slice(location.origin.length))
      if (!(path in mocks))
        return passthrough()

      const mock = mocks[path]

      // using a factory
      if (mock === undefined) {
        const exportsModule = await getFactoryExports(path)
        const exports = Object.keys(exportsModule)
        const module = `const module = __vitest_mocker__.get('${path}');`
        const keys = exports.map((name) => {
          if (name === 'default')
            return `export default module['default'];`
          return `export const ${name} = module['${name}'];`
        }).join('\n')
        const text = `${module}\n${keys}`
        return new Response(text, {
          headers: {
            'Content-Type': 'application/javascript',
          },
        })
      }

      if (typeof mock === 'string')
        return Response.redirect(mock)

      const content = await rpc().automock(path)
      return new Response(content, {
        headers: {
          'Content-Type': 'application/javascript',
        },
      })
    }),
  )

  await worker.start({
    serviceWorker: {
      url: '/__virtual_vitest__:mocker-worker.js',
    },
    quiet: true,
  })
}

function getFactoryExports(id: string) {
  channel.postMessage({
    type: 'mock-factory:request',
    id,
  })
  return new Promise<string[]>((resolve) => {
    channel.addEventListener('message', function onMessage(e: MessageEvent<IframeChannelEvent>) {
      if (e.data.type === 'mock-factory:response') {
        resolve(e.data.exports)
        channel.removeEventListener('message', onMessage)
      }
    })
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

import { channel } from '@vitest/browser/client'
import type {
  IframeChannelEvent,
  IframeMockFactoryRequestEvent,
  IframeMockingDoneEvent,
} from '@vitest/browser/client'
import type { MockedModuleSerialized } from '@vitest/mocker'
import { ManualMockedModule } from '@vitest/mocker'
import { ModuleMockerMSWInterceptor } from '@vitest/mocker/browser'
import { nanoid } from '@vitest/utils'

export class VitestBrowserModuleMockerInterceptor extends ModuleMockerMSWInterceptor {
  override async register(event: MockedModuleSerialized): Promise<void> {
    if (event.type === 'manual') {
      const module = ManualMockedModule.fromJSON(event, async () => {
        const keys = await getFactoryExports(event.url)
        return Object.fromEntries(keys.map(key => [key, null]))
      })
      await super.register(module)
    }
    else {
      await this.init()
      this.mocks.register(event)
    }
    channel.postMessage(<IframeMockingDoneEvent>{ type: 'mock:done' })
  }

  override async delete(url: string): Promise<void> {
    await super.delete(url)
    channel.postMessage(<IframeMockingDoneEvent>{ type: 'unmock:done' })
  }
}

export function createModuleMockerInterceptor() {
  return new VitestBrowserModuleMockerInterceptor({
    globalThisAccessor: '"__vitest_mocker__"',
    mswOptions: {
      serviceWorker: {
        url: '/mockServiceWorker.js',
        options: {
          scope: '/',
        },
      },
      quiet: true,
    },
  })
}

function getFactoryExports(id: string) {
  const eventId = nanoid()
  channel.postMessage({
    type: 'mock-factory:request',
    eventId,
    id,
  } satisfies IframeMockFactoryRequestEvent)
  return new Promise<string[]>((resolve, reject) => {
    channel.addEventListener(
      'message',
      function onMessage(e: MessageEvent<IframeChannelEvent>) {
        if (e.data.type === 'mock-factory:response' && e.data.eventId === eventId) {
          resolve(e.data.exports)
          channel.removeEventListener('message', onMessage)
        }
        if (e.data.type === 'mock-factory:error' && e.data.eventId === eventId) {
          reject(e.data.error)
          channel.removeEventListener('message', onMessage)
        }
      },
    )
  })
}

import type { IframeChannelOutgoingEvent } from '@vitest/browser/client'
import { channel } from '@vitest/browser/client'
import { ModuleMocker } from '@vitest/mocker/browser'
import { getBrowserState } from '../utils'

export class VitestBrowserClientMocker extends ModuleMocker {
  setupWorker() {
    channel.addEventListener(
      'message',
      async (e: MessageEvent<IframeChannelOutgoingEvent>) => {
        if (e.data.type === 'mock-factory:request') {
          try {
            const module = await this.resolveFactoryModule(e.data.id)
            const exports = Object.keys(module)
            channel.postMessage({
              type: 'mock-factory:response',
              exports,
            })
          }
          catch (err: any) {
            channel.postMessage({
              type: 'mock-factory:error',
              error: {
                name: err.name,
                message: err.message,
                stack: err.stack,
              },
            })
          }
        }
      },
    )
  }

  // default "vi" utility tries to access mock context to avoid circular dependencies
  public getMockContext() {
    return { callstack: null }
  }

  public override wrapDynamicImport<T>(moduleFactory: () => Promise<T>): Promise<T> {
    return getBrowserState().wrapModule(moduleFactory)
  }
}

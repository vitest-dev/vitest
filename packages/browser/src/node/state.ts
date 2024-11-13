import type { BrowserServerStateContext, BrowserServerState as IBrowserServerState } from 'vitest/node'
import type { BrowserServerCDPHandler } from './cdp'
import type { WebSocketBrowserRPC } from './types'
import { createDefer } from '@vitest/utils'

export class BrowserServerState implements IBrowserServerState {
  public readonly orchestrators = new Map<string, WebSocketBrowserRPC>()
  public readonly testers = new Map<string, WebSocketBrowserRPC>()
  public readonly cdps = new Map<string, BrowserServerCDPHandler>()

  private contexts = new Map<string, BrowserServerStateContext>()

  getContext(contextId: string) {
    return this.contexts.get(contextId)
  }

  createAsyncContext(method: 'run' | 'collect', contextId: string, files: string[]): Promise<void> {
    const defer = createDefer<void>()
    this.contexts.set(contextId, {
      files,
      method,
      resolve: () => {
        defer.resolve()
        this.contexts.delete(contextId)
      },
      reject: defer.reject,
    })
    return defer
  }

  async removeCDPHandler(sessionId: string) {
    this.cdps.delete(sessionId)
  }
}

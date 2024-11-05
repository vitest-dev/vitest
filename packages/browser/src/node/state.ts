import type { BrowserServerStateContext, BrowserServerState as IBrowserServerState } from 'vitest/node'
import type { BrowserServerCDPHandler } from './cdp'
import type { WebSocketBrowserRPC } from './types'
import { createDefer } from '@vitest/utils'

export class BrowserServerState implements IBrowserServerState {
  public readonly orchestrators = new Map<string, WebSocketBrowserRPC>()
  public readonly testers = new Map<string, WebSocketBrowserRPC>()
  public readonly cdps = new Map<string, BrowserServerCDPHandler>()

  private contexts = new Map<string, BrowserServerStateContext>()
  private _onReady: ((contextId: string, orchestrator: WebSocketBrowserRPC) => void) | undefined
  private _onError: ((contextId: string, error: unknown) => void) | undefined

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
        const orchestrator = this.orchestrators.get(contextId)
        if (orchestrator) {
          this._onReady?.(contextId, orchestrator)
        }
      },
      reject: (err) => {
        this._onError?.(contextId, err)
        defer.reject(err)
      },
    })
    return defer
  }

  onReady(cb: (contextId: string, orchestrator: WebSocketBrowserRPC) => void) {
    this._onReady = cb
  }

  onError(cb: (contextId: string, error: unknown) => void): void {
    this._onError = cb
  }

  cleanListeners() {
    this._onReady = undefined
    this._onError = undefined
  }

  async removeCDPHandler(sessionId: string) {
    this.cdps.delete(sessionId)
  }
}

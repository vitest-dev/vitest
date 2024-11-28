import type { BrowserServerState as IBrowserServerState } from 'vitest/node'
import type { WebSocketBrowserRPC } from './types'

export class BrowserServerState implements IBrowserServerState {
  public readonly orchestrators = new Map<string, WebSocketBrowserRPC>()
  public readonly testers = new Map<string, WebSocketBrowserRPC>()
}

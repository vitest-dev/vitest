import type { BrowserServerState as IBrowserServerState } from 'vitest/node'
import type { WebSocketBrowserRPC } from '../types'

export class BrowserServerState implements IBrowserServerState {
  public readonly orchestrators: Map<string, WebSocketBrowserRPC> = new Map()
  public readonly testers: Map<string, WebSocketBrowserRPC> = new Map()
}

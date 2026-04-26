import type { BrowserServerState as IBrowserServerState } from 'vitest/node'
import type { BrowserTraceEntry, WebSocketBrowserRPC } from '../types'

export interface StreamedTraceBuffer {
  retry: number
  repeats: number
  recordCanvas: boolean
  entries: BrowserTraceEntry[]
}

export class BrowserServerState implements IBrowserServerState {
  public readonly orchestrators: Map<string, WebSocketBrowserRPC> = new Map()
  public readonly testers: Map<string, WebSocketBrowserRPC> = new Map()
  public readonly streamedTraceEntries: Map<string, StreamedTraceBuffer> = new Map()
}

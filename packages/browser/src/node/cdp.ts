import type { CDPSession } from 'vitest/node'
import type { WebSocketBrowserRPC } from '../types'

export class BrowserServerCDPHandler {
  private listenerIds: Record<string, string[]> = {}

  private listeners: Record<string, (payload: unknown) => void> = {}

  constructor(
    private session: CDPSession,
    private tester: WebSocketBrowserRPC,
  ) {}

  send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return this.session.send(method, params)
  }

  on(event: string, id: string, once = false): void {
    if (!this.listenerIds[event]) {
      this.listenerIds[event] = []
    }
    this.listenerIds[event].push(id)

    if (!this.listeners[event]) {
      this.listeners[event] = (payload) => {
        this.tester.cdpEvent(
          event,
          payload,
        )
        if (once) {
          this.off(event, id)
        }
      }

      this.session.on(event, this.listeners[event])
    }
  }

  off(event: string, id: string): void {
    if (!this.listenerIds[event]) {
      this.listenerIds[event] = []
    }
    this.listenerIds[event] = this.listenerIds[event].filter(l => l !== id)

    if (!this.listenerIds[event].length) {
      this.session.off(event, this.listeners[event])
      delete this.listeners[event]
    }
  }

  once(event: string, listener: string): void {
    this.on(event, listener, true)
  }
}

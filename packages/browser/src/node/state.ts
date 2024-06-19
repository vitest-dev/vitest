import { createDefer } from '@vitest/utils'
import type { WebSocketBrowserRPC } from './types'

export class BrowserState {
  public orchestrators = new Map<string, WebSocketBrowserRPC>()
  public testers = new Map<string, WebSocketBrowserRPC>()

  private contexts = new Map<
    string,
    {
      files: string[]
      resolve: () => void
      reject: (v: unknown) => void
    }
  >()

  getContext(contextId: string) {
    return this.contexts.get(contextId)
  }

  createAsyncContext(contextId: string, files: string[]): Promise<void> {
    const defer = createDefer<void>()
    this.contexts.set(contextId, {
      files,
      resolve: () => {
        defer.resolve()
        this.contexts.delete(contextId)
      },
      reject: defer.reject,
    })
    return defer
  }
}

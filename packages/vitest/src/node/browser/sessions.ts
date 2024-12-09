import type { TestProject } from 'vitest/node'
import type { BrowserServerStateSession } from '../types/browser'
import { createDefer } from '@vitest/utils'

export class BrowserSessions {
  private sessions = new Map<string, BrowserServerStateSession>()

  getSession(sessionId: string) {
    return this.sessions.get(sessionId)
  }

  createAsyncSession(method: 'run' | 'collect', sessionId: string, files: string[], project: TestProject): Promise<void> {
    const defer = createDefer<void>()
    this.sessions.set(sessionId, {
      files,
      method,
      project,
      resolve: () => {
        defer.resolve()
        this.sessions.delete(sessionId)
      },
      reject: defer.reject,
    })
    return defer
  }
}

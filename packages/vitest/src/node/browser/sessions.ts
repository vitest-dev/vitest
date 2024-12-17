import type { TestProject } from '../project'
import type { BrowserServerStateSession } from '../types/browser'
import { createDefer } from '@vitest/utils'

export class BrowserSessions {
  private sessions = new Map<string, BrowserServerStateSession>()

  getSession(sessionId: string) {
    return this.sessions.get(sessionId)
  }

  createAsyncSession(method: 'run' | 'collect', sessionId: string, files: string[], project: TestProject): Promise<void> {
    const defer = createDefer<void>()

    const timeout = setTimeout(() => {
      defer.reject(new Error(`Failed to connect to the browser session "${sessionId}" within the timeout.`))
    }, project.vitest.config.browser.connectTimeout ?? 60_000).unref()

    this.sessions.set(sessionId, {
      files,
      method,
      project,
      connected: () => {
        clearTimeout(timeout)
      },
      resolve: () => {
        defer.resolve()
        this.sessions.delete(sessionId)
      },
      reject: defer.reject,
    })
    return defer
  }
}

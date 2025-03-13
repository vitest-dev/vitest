import type { TestProject } from '../project'
import type { BrowserServerStateSession } from '../types/browser'
import { createDefer } from '@vitest/utils'

export class BrowserSessions {
  private sessions = new Map<string, BrowserServerStateSession>()

  getSession(sessionId: string): BrowserServerStateSession | undefined {
    return this.sessions.get(sessionId)
  }

  forgetSession(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  createSession(sessionId: string, project: TestProject): Promise<void> {
    const defer = createDefer<void>()

    const timeout = setTimeout(() => {
      defer.reject(new Error(`Failed to connect to the browser session "${sessionId}" [${project.name}] within the timeout.`))
    }, project.vitest.config.browser.connectTimeout ?? 60_000).unref()

    this.sessions.set(sessionId, {
      project,
      connected: () => {
        defer.resolve()
        clearTimeout(timeout)
      },
      reject: defer.reject,
    })
    return defer
  }
}

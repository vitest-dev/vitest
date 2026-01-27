import type { TestProject } from '../project'
import type { BrowserServerStateSession } from '../types/browser'
import { createDefer } from '@vitest/utils/helpers'

export class BrowserSessions {
  private sessions = new Map<string, BrowserServerStateSession>()

  public sessionIds: Set<string> = new Set()

  getSession(sessionId: string): BrowserServerStateSession | undefined {
    return this.sessions.get(sessionId)
  }

  destroySession(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  createSession(sessionId: string, project: TestProject, pool: { reject: (error: Error) => void }): Promise<void> {
    // this promise only waits for the WS connection with the orhcestrator to be established
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
      // this fails the whole test run and cancels the pool
      fail: (error: Error) => {
        defer.resolve()
        clearTimeout(timeout)
        pool.reject(error)
      },
    })
    return defer
  }
}

import type { TestProject } from '../project'
import type { BrowserServerStateSession } from '../types/browser'
import { createDefer } from '@vitest/utils'
import { relative } from 'pathe'

export class BrowserSessions {
  private sessions = new Map<string, BrowserServerStateSession>()

  getSession(sessionId: string): BrowserServerStateSession | undefined {
    return this.sessions.get(sessionId)
  }

  createAsyncSession(method: 'run' | 'collect', sessionId: string, files: string[], project: TestProject): Promise<void> {
    const defer = createDefer<void>()

    const timeout = setTimeout(() => {
      const tests = files.map(file => relative(project.config.root, file)).join('", "')
      defer.reject(new Error(`Failed to connect to the browser session "${sessionId}" [${project.name}] for "${tests}" within the timeout.`))
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
        clearTimeout(timeout)
        this.sessions.delete(sessionId)
      },
      reject: defer.reject,
    })
    return defer
  }
}

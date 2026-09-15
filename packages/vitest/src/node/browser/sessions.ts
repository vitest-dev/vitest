import type { OTELCarrier } from '../../utils/traces'
import type { TestProject } from '../project'
import type { BrowserServerStateSession } from '../types/browser'
import { createDefer } from '@vitest/utils/helpers'

export class BrowserSessions {
  private sessions = new Map<string, BrowserServerStateSession>()
  private pendingUpdates = new Map<string, { count: number; waiters: (() => void)[] }>()

  public sessionIds: Set<string> = new Set()

  getSession(sessionId: string): BrowserServerStateSession | undefined {
    return this.sessions.get(sessionId)
  }

  startUpdate(sessionId: string): void {
    const pending = this.pendingUpdates.get(sessionId)
    if (pending) {
      pending.count++
    }
    else {
      this.pendingUpdates.set(sessionId, { count: 1, waiters: [] })
    }
  }

  finishUpdate(sessionId: string): void {
    const pending = this.pendingUpdates.get(sessionId)
    if (!pending) {
      return
    }
    pending.count--
    if (pending.count > 0) {
      return
    }
    this.pendingUpdates.delete(sessionId)
    pending.waiters.forEach(resolve => resolve())
  }

  // the results of the last test can still be arriving when the session has no tests left
  waitForUpdates(sessionId: string): Promise<void> {
    const pending = this.pendingUpdates.get(sessionId)
    if (!pending) {
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      pending.waiters.push(resolve)
    })
  }

  destroySession(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  createSession(
    sessionId: string,
    project: TestProject,
    pool: { reject: (error: Error) => void },
    options?: { otelCarrier?: OTELCarrier },
  ): Promise<void> {
    // this promise waits until the orchestrator is ready to accept RPC calls
    const defer = createDefer<void>()
    let isConnected = false
    let isReady = false
    const timeout = setTimeout(() => {
      defer.reject(new Error(`Failed to connect to the browser session "${sessionId}" [${project.name}] within the timeout.`))
    }, project.config.browser.connectTimeout ?? 60_000).unref()

    const resolveIfReady = () => {
      if (!isConnected || !isReady) {
        return
      }
      defer.resolve()
      clearTimeout(timeout)
    }

    this.sessions.set(sessionId, {
      project,
      otelCarrier: options?.otelCarrier,
      // assigned by the pool on the session's first run, freed when it disconnects
      concurrencyId: 0,
      connected: () => {
        isConnected = true
        resolveIfReady()
      },
      ready: () => {
        isReady = true
        resolveIfReady()
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

import { createServer } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserConnectionError } from 'vitest/node'
import { setupBrowserRpc } from '../../../packages/browser/src/node/rpc'
import { BrowserSessions } from '../../../packages/vitest/src/node/browser/sessions'

function setupTestServer() {
  const httpServer = createServer()
  const sessions = new BrowserSessions()
  const orchestrators = new Map<string, any>()
  const testers = new Map<string, any>()
  const poolReject = vi.fn()

  const project = {
    name: 'browser',
    config: {
      browser: { connectTimeout: 5000, api: { allowExec: true, allowWrite: true } },
    },
    vitest: {
      config: { browser: { connectTimeout: 5000 } },
      onCancel: () => () => {},
    },
    browser: {
      provider: {},
      state: { orchestrators, testers },
      config: { browser: { connectTimeout: 5000 } },
      commands: {},
    },
  } as any

  const globalServer = {
    vite: { httpServer },
    vitest: {
      config: { api: { token: 'test-token' } },
      logger: { warn: vi.fn() },
      state: { catchError: vi.fn() },
      _browserSessions: sessions,
      getProjectByName: () => project,
      onCancel: () => () => {},
    },
    removeCDPHandler: vi.fn(),
  } as any

  setupBrowserRpc(globalServer, {} as any, new Map())

  return {
    httpServer,
    sessions,
    clients: orchestrators,
    poolReject,
    project,
    listen: () =>
      new Promise<number>((resolve) => {
        httpServer.listen(0, '127.0.0.1', () => {
          resolve((httpServer.address() as { port: number }).port)
        })
      }),
  }
}

describe('browser orchestrator disconnect vs crash attribution', () => {
  const servers: Array<ReturnType<typeof createServer>> = []

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (s) =>
          new Promise<void>((resolve) => {
            s.close(() => resolve())
          }),
      ),
    )
  })

  it('attributes failure to crash error when page.on("crash") arrives shortly after socket close', async () => {
    const ctx = setupTestServer()
    servers.push(ctx.httpServer)
    const port = await ctx.listen()

    ctx.sessions.sessionIds.add('s1')
    ctx.sessions.createSession('s1', ctx.project, { reject: ctx.poolReject }).catch(() => {})

    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/__vitest_browser_api__?type=orchestrator&rpcId=r1&sessionId=s1&projectName=browser&token=test-token`,
    )
    await new Promise<void>((resolve) => ws.addEventListener('open', () => resolve(), { once: true }))

    // Wait until server registers the client
    await vi.waitFor(() => {
      expect(ctx.clients.has('r1')).toBe(true)
    })
    ctx.sessions.getSession('s1')!.connected()
    ctx.sessions.getSession('s1')!.ready()
    const rpc = ctx.clients.get('r1')!
    const pendingRpc = rpc.createTesters({ files: [], providedContext: '{}' })

    ws.close()
    await new Promise((resolve) => setTimeout(resolve, 10))

    const session = ctx.sessions.getSession('s1')
    expect(session).toBeDefined()
    session!.fail(new BrowserConnectionError('The chromium page crashed while running tests.'))

    await expect(pendingRpc).rejects.toThrow('The chromium page crashed while running tests.')
    expect(ctx.poolReject).toHaveBeenCalledTimes(1)
    expect(ctx.poolReject.mock.calls[0][0].message).toContain('The chromium page crashed')
    expect(ctx.sessions.getSession('s1')).toBeUndefined()
  })

  it('falls back to generic BrowserConnectionError when no crash occurs after disconnect', async () => {
    const ctx = setupTestServer()
    servers.push(ctx.httpServer)
    const port = await ctx.listen()

    ctx.sessions.sessionIds.add('s2')
    ctx.sessions.createSession('s2', ctx.project, { reject: ctx.poolReject }).catch(() => {})

    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/__vitest_browser_api__?type=orchestrator&rpcId=r2&sessionId=s2&projectName=browser&token=test-token`,
    )
    await new Promise<void>((resolve) => ws.addEventListener('open', () => resolve(), { once: true }))

    await vi.waitFor(() => {
      expect(ctx.clients.has('r2')).toBe(true)
    })
    ctx.sessions.getSession('s2')!.connected()
    ctx.sessions.getSession('s2')!.ready()
    const rpc = ctx.clients.get('r2')!
    const pendingRpc = rpc.createTesters({ files: [], providedContext: '{}' })

    ws.close()

    await expect(pendingRpc).rejects.toThrow(
      '[vitest] Browser connection was closed while running tests. Was the page closed unexpectedly?',
    )
    expect(ctx.sessions.getSession('s2')).toBeUndefined()
  })
})

import type { CDPSession } from 'vitest/node'
import type { WebSocketBrowserRPC } from '../../../packages/browser/src/types'
import { describe, expect, test, vi } from 'vitest'
import { BrowserServerCDPHandler } from '../../../packages/browser/src/node/cdp'

function createSession() {
  const listeners = new Map<string, (payload: unknown) => void>()
  return {
    send: vi.fn(),
    on: vi.fn((event: string, listener: (payload: unknown) => void) => {
      listeners.set(event, listener)
    }),
    off: vi.fn((event: string) => {
      listeners.delete(event)
    }),
    once: vi.fn(),
    emit(event: string, payload: unknown) {
      listeners.get(event)?.(payload)
    },
  } as unknown as CDPSession & { emit: (event: string, payload: unknown) => void }
}

function createTester() {
  return {
    cdpEvent: vi.fn(),
  } as unknown as WebSocketBrowserRPC
}

describe('BrowserServerCDPHandler', () => {
  test('forwards session events to the tester while subscribed', () => {
    const session = createSession()
    const tester = createTester()
    const handler = new BrowserServerCDPHandler(session, tester)

    handler.on('Console.messageAdded', 'listener-1')
    session.emit('Console.messageAdded', { text: 'hello' })

    expect(tester.cdpEvent).toHaveBeenCalledWith('Console.messageAdded', { text: 'hello' })
  })

  test('dispose() removes every registered listener from the session', () => {
    const session = createSession()
    const tester = createTester()
    const handler = new BrowserServerCDPHandler(session, tester)

    handler.on('Console.messageAdded', 'listener-1')
    handler.on('Debugger.scriptParsed', 'listener-2')

    handler.dispose()

    expect(session.off).toHaveBeenCalledWith('Console.messageAdded', expect.any(Function))
    expect(session.off).toHaveBeenCalledWith('Debugger.scriptParsed', expect.any(Function))
  })

  test('dispose() stops forwarding events that fire after teardown', () => {
    const session = createSession()
    const tester = createTester()
    const handler = new BrowserServerCDPHandler(session, tester)

    handler.on('Console.messageAdded', 'listener-1')
    handler.dispose()

    // simulates a stale CDP event arriving after the tester's RPC channel closed
    session.emit('Console.messageAdded', { text: 'stale' })

    expect(tester.cdpEvent).not.toHaveBeenCalled()
  })
})

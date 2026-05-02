import type { WebSocketConnection } from '../../../packages/browser/src/client/connection'
import { afterEach, expect, it, vi } from 'vitest'
import { createWebSocketConnection } from '../../../packages/browser/src/client/connection'

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = []
  static reset(): void {
    FakeWebSocket.instances = []
  }

  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readonly CONNECTING = FakeWebSocket.CONNECTING
  readonly OPEN = FakeWebSocket.OPEN
  readonly CLOSING = FakeWebSocket.CLOSING
  readonly CLOSED = FakeWebSocket.CLOSED

  readonly url: string
  readyState: number = FakeWebSocket.CONNECTING
  sent: string[] = []

  constructor(url: string) {
    super()
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    this.dispatchClose()
  }

  dispatchOpen(): void {
    this.readyState = FakeWebSocket.OPEN
    this.dispatchEvent(new Event('open'))
  }

  dispatchClose(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.dispatchEvent(new Event('close'))
  }

  dispatchMessage(data: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data }))
  }
}

afterEach(() => {
  FakeWebSocket.reset()
  vi.useRealTimers()
})

function newConnection(overrides?: { reconnectTries?: number }): WebSocketConnection {
  return createWebSocketConnection({
    url: 'ws://test.invalid/',
    WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    reconnectInterval: 10,
    reconnectTries: overrides?.reconnectTries ?? 3,
    connectTimeout: 60_000,
  })
}

it('waitForConnection survives a drop-before-open and resolves on a later attempt', async () => {
  vi.useFakeTimers()
  const connection = newConnection()
  const waiter = connection.waitForConnection()

  expect(FakeWebSocket.instances).toHaveLength(1)
  FakeWebSocket.instances[0].dispatchClose()

  vi.advanceTimersByTime(20)
  expect(FakeWebSocket.instances).toHaveLength(2)

  FakeWebSocket.instances[1].dispatchOpen()
  await expect(waiter).resolves.toBeUndefined()
})

it('ignores stale events from a replaced socket', async () => {
  vi.useFakeTimers()
  const connection = newConnection()
  const waiter = connection.waitForConnection()

  FakeWebSocket.instances[0].dispatchClose()
  vi.advanceTimersByTime(20)
  FakeWebSocket.instances[1].dispatchOpen()
  await waiter

  const messages: unknown[] = []
  connection.onMessage(data => messages.push(data))

  FakeWebSocket.instances[0].dispatchMessage('stale')
  FakeWebSocket.instances[0].dispatchClose()
  FakeWebSocket.instances[1].dispatchMessage('live')

  expect(messages).toEqual(['live'])
  expect(FakeWebSocket.instances).toHaveLength(2)
})

it('rejects with a clear error when retries are exhausted before any open', async () => {
  vi.useFakeTimers()
  const connection = newConnection({ reconnectTries: 2 })
  const waiter = connection.waitForConnection()

  FakeWebSocket.instances[0].dispatchClose()
  vi.advanceTimersByTime(20)
  FakeWebSocket.instances[1].dispatchClose()

  await expect(waiter).rejects.toThrow('WebSocket connection closed before opening')
})

it('returns the same promise across reconnects until it settles', () => {
  vi.useFakeTimers()
  const connection = newConnection()
  const first = connection.waitForConnection()

  FakeWebSocket.instances[0].dispatchClose()
  vi.advanceTimersByTime(20)
  const second = connection.waitForConnection()

  expect(second).toBe(first)
})

it('hands out a fresh promise after a successful connection has been awaited', async () => {
  vi.useFakeTimers()
  const connection = newConnection()
  const first = connection.waitForConnection()
  FakeWebSocket.instances[0].dispatchOpen()
  await first

  FakeWebSocket.instances[0].dispatchClose()
  vi.advanceTimersByTime(20)
  const next = connection.waitForConnection()

  expect(next).not.toBe(first)
})

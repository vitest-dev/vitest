/* eslint-disable no-console -- the whole point is to observe patched console calls */
import { afterEach, describe, expect, it, vi } from 'vitest'

const sendLog = vi.fn()
const getConfig = vi.fn(() => ({ printConsoleTrace: false }))
const getBrowserRunner = vi.fn((): { method: 'run' | 'collect' } | undefined => ({ method: 'run' }))

vi.mock('../../../packages/browser/src/client/tester/rpc', () => ({ rpc: () => ({ sendLog }) }))
vi.mock('../../../packages/browser/src/client/tester/runner', () => ({ getBrowserRunner }))
vi.mock('../../../packages/browser/src/client/utils', () => ({ getConfig }))
vi.mock('vitest/internal/browser', () => ({
  format: (args: unknown[]) => args.map(String).join(' '),
}))

const { setupConsoleLogSpy } = await import('../../../packages/browser/src/client/tester/logger')

// setupConsoleLogSpy patches the global console, so hand the runner's own
// methods back before the reporter tries to print a result
const realConsole = { ...console }

function restoreConsole() {
  for (const key of Object.keys(realConsole) as (keyof Console)[]) {
    ;(console as any)[key] = realConsole[key]
  }
}

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('browser console log batching', () => {
  afterEach(() => {
    restoreConsole()
    sendLog.mockClear()
    getConfig.mockReturnValue({ printConsoleTrace: false })
  })

  it('sends one request per macrotask instead of one per console call', async () => {
    setupConsoleLogSpy()

    for (let i = 0; i < 100; i++) {
      console.log('line', i)
    }

    // nothing is sent synchronously: the batch waits for the macrotask boundary
    expect(sendLog).not.toHaveBeenCalled()

    await flushMicrotasks()

    expect(sendLog).toHaveBeenCalledTimes(1)
    const [method, logs] = sendLog.mock.calls[0]
    expect(method).toBe('run')
    expect(logs).toHaveLength(100)
    expect(logs[0]).toMatchObject({ type: 'stdout', content: 'line 0', browser: true })
    expect(logs[99]).toMatchObject({ type: 'stdout', content: 'line 99' })
  })

  it('keeps stdout and stderr logs in one batch, in call order', async () => {
    setupConsoleLogSpy()

    console.log('first')
    console.error('second')
    console.log('third')

    await flushMicrotasks()

    expect(sendLog).toHaveBeenCalledTimes(1)
    const logs = sendLog.mock.calls[0][1]
    expect(logs.map((log: { content: string }) => log.content)).toEqual([
      'first',
      'second',
      'third',
    ])
    expect(logs.map((log: { type: string }) => log.type)).toEqual(['stdout', 'stderr', 'stdout'])
  })

  it('splits into separate batches per execution method', async () => {
    setupConsoleLogSpy()

    console.log('from run')
    getBrowserRunner.mockReturnValue({ method: 'collect' })
    console.log('from collect')

    await flushMicrotasks()

    expect(sendLog).toHaveBeenCalledTimes(2)
    expect(sendLog.mock.calls.map(([method]) => method)).toEqual(['run', 'collect'])
  })

  it('caps a batch so a tight loop cannot build one unbounded message', async () => {
    setupConsoleLogSpy()

    for (let i = 0; i < 600; i++) {
      console.log('spam', i)
    }

    // 500 flushed inline, the rest queued for the macrotask boundary
    expect(sendLog).toHaveBeenCalledTimes(1)
    expect(sendLog.mock.calls[0][1]).toHaveLength(500)

    await flushMicrotasks()

    expect(sendLog).toHaveBeenCalledTimes(2)
    expect(sendLog.mock.calls[1][1]).toHaveLength(100)
  })

  it('still records a stack for every log when printConsoleTrace is on', async () => {
    getConfig.mockReturnValue({ printConsoleTrace: true })
    setupConsoleLogSpy()

    console.log('with stack')

    await flushMicrotasks()

    expect(sendLog).toHaveBeenCalledTimes(1)
    const logs = sendLog.mock.calls[0][1]
    // the STACK_TRACE header line is stripped, so the origin is the frames
    expect(logs[0].origin).toContain('logger.ts')
  })
})

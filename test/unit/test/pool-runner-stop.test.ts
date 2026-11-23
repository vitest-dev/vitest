import { describe, expect, it, vi } from 'vitest'
import { PoolRunner } from '../../../packages/vitest/src/node/pools/poolRunner'

vi.mock('../../../packages/vitest/src/node/pools/rpc', () => ({
  createMethodsRPC: () => ({}),
}))

describe('PoolRunner.stop', () => {
  it('resolves waitForTerminated when stopped in IDLE state', async () => {
    const worker = {
      name: 'vmThreads',
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
      send: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      canReuse: () => true,
      deserialize: (v: unknown) => v,
    }
    const project = {
      name: 'test',
      config: { teardownTimeout: 1000 },
      vitest: {
        state: { catchError: vi.fn() },
        onCancel: () => () => {},
        _traces: {
          isEnabled: () => false,
          $: (_name: string, _opts: unknown, fn?: () => unknown) => (fn ? fn() : undefined),
          startSpan: () => ({ end: vi.fn(), setAttribute: vi.fn() }),
        },
      },
    } as any

    const runner = new PoolRunner(
      {
        distPath: '',
        project,
        method: 'run',
        environment: { name: 'node' } as any,
        env: {},
        execArgv: [],
      },
      worker as any,
    )

    await runner.stop()
    await expect(runner.waitForTerminated()).resolves.toBeUndefined()
    expect(runner.isTerminated).toBe(true)
  })
})

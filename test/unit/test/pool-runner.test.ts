import type { PoolWorker } from '../../../packages/vitest/src/node/pools/types'
import { describe, expect, it, vi } from 'vitest'
import { PoolRunner } from '../../../packages/vitest/src/node/pools/poolRunner'

describe('PoolRunner.stop', () => {
  function createTestRunner() {
    const mockVitest: any = {
      _traces: {
        isEnabled: () => false,
        startSpan: () => ({ end: vi.fn(), setAttribute: vi.fn() }),
        startContextSpan: () => ({
          span: { end: vi.fn(), setAttribute: vi.fn(), recordException: vi.fn() },
          context: {},
        }),
        $: vi.fn((_name, _ctx, fn) => fn()),
      },
      state: {
        metadata: {},
        catchError: vi.fn(),
      },
      onCancel: vi.fn(() => vi.fn()),
    }

    const mockProject: any = {
      name: 'default',
      vitest: mockVitest,
      config: { dumpDir: undefined },
      vite: { environments: {} },
      _transformService: {},
    }

    const mockEnvironment: any = {
      name: 'node',
    }

    const mockWorker: PoolWorker = {
      name: 'forks',
      on: vi.fn(),
      off: vi.fn(),
      send: vi.fn(),
      deserialize: (d) => d,
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    }

    const runner = new PoolRunner(
      {
        project: mockProject,
        environment: mockEnvironment,
      },
      mockWorker,
    )

    return { runner, mockWorker, mockVitest }
  }

  it('force-terminates worker process when stop handshake times out', async () => {
    vi.useFakeTimers()
    try {
      const { runner, mockWorker } = createTestRunner()

      // Put runner into STARTED state
      ;(runner as any)._state = 'started'

      // Initiate stop, worker never sends 'stopped' message back
      const stopPromise = runner.stop()
      const assertionPromise = expect(stopPromise).rejects.toThrowError(
        '[vitest-pool-runner]: Timeout waiting for worker to respond',
      )

      // Fast-forward past STOP_TIMEOUT (60_000ms)
      await vi.advanceTimersByTimeAsync(60_000)

      await assertionPromise

      // The worker process/thread must still be stopped/killed
      expect(mockWorker.stop).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('terminates worker process on normal graceful stop', async () => {
    const { runner, mockWorker } = createTestRunner()
    ;(runner as any)._state = 'started'

    // Mock worker receiving message and replying 'stopped'
    mockWorker.send = vi.fn((message) => {
      if (message.type === 'stop') {
        ;(runner as any)._eventEmitter.emit('message', {
          type: 'stopped',
          __vitest_worker_response__: true,
        })
      }
    })

    await runner.stop()

    expect(mockWorker.stop).toHaveBeenCalledTimes(1)
  })

  it('terminates worker process when force option is passed', async () => {
    const { runner, mockWorker } = createTestRunner()
    ;(runner as any)._state = 'started'

    await runner.stop({ force: true })

    expect(mockWorker.stop).toHaveBeenCalledTimes(1)
  })

  it('preserves timeout error when worker.stop rejects during timeout cleanup', async () => {
    vi.useFakeTimers()
    try {
      const { runner, mockWorker } = createTestRunner()
      mockWorker.stop = vi.fn().mockRejectedValue(new Error('Kill failed'))
      ;(runner as any)._state = 'started'

      const stopPromise = runner.stop()
      const assertionPromise = expect(stopPromise).rejects.toThrowError(
        '[vitest-pool-runner]: Timeout waiting for worker to respond',
      )

      await vi.advanceTimersByTimeAsync(60_000)
      await assertionPromise

      expect(mockWorker.stop).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

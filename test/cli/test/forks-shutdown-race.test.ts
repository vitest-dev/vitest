import { EventEmitter } from 'node:events'
import { resolve } from 'pathe'
import { expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'

/**
 * Mock PoolWorker that simulates the forks worker lifecycle and tracks
 * which event listeners are active at each phase of the shutdown.
 */
function createMockWorker() {
  const emitter = new EventEmitter()

  // Track listener registrations to verify the fix
  const listenerLog: string[] = []

  return {
    name: 'mock-forks',
    cacheFs: false,
    emitter,
    listenerLog,

    on(event: string, cb: (arg: any) => void) {
      listenerLog.push(`on:${event}`)
      emitter.on(event, cb)
    },

    off(event: string, cb: (arg: any) => void) {
      listenerLog.push(`off:${event}`)
      emitter.off(event, cb)
    },

    send(message: any) {
      if (message.type === 'start') {
        queueMicrotask(() => {
          emitter.emit('message', {
            __vitest_worker_response__: true,
            type: 'started',
          })
        })
      }

      if (message.type === 'run' || message.type === 'collect') {
        queueMicrotask(() => {
          emitter.emit('message', {
            __vitest_worker_response__: true,
            type: 'testfileFinished',
          })
        })
      }

      if (message.type === 'stop') {
        // Record which listeners are still active when stop message arrives.
        // This is the window where IPC errors would fire on a real ChildProcess.
        listenerLog.push(`stop-received:error-listeners=${emitter.listenerCount('error')}`)

        queueMicrotask(() => {
          emitter.emit('message', {
            __vitest_worker_response__: true,
            type: 'stopped',
          })
        })
      }
    },

    deserialize(data: unknown) {
      return data
    },

    async start() {},

    async stop() {},
  }
}

test('error listener is removed before stop message is sent', async () => {
  const workers: ReturnType<typeof createMockWorker>[] = []

  const vitest = await createVitest('test', {
    watch: false,
    maxWorkers: 2,
    root: resolve(import.meta.dirname, '../fixtures/forks-shutdown-race'),
    reporters: [{ onTestRunEnd() {} }],
    pool: {
      // Use a custom name to bypass the built-in pool switch/case.
      // The mock worker's name is 'mock-forks' to match.
      name: 'mock-forks',
      // @ts-expect-error -- using mock worker
      createPoolWorker: () => {
        const worker = createMockWorker()
        workers.push(worker)
        return worker
      },
    },
  })
  onTestFinished(() => vitest.close())

  await vitest.start()

  // Verify that for every worker, the error listener was removed
  // BEFORE the stop message was sent (0 error listeners at stop time).
  // This confirms the fix closes the race window.
  for (const worker of workers) {
    const stopEntry = worker.listenerLog.find(e => e.startsWith('stop-received:'))
    expect(stopEntry, 'Worker should have received a stop message').toBeDefined()
    expect(
      stopEntry,
      'Error listener should be removed before stop message is sent',
    ).toBe('stop-received:error-listeners=0')
  }

  // Also verify the listener lifecycle: error should be added during
  // start and removed during stop, before the stop message
  for (const worker of workers) {
    const onError = worker.listenerLog.filter(e => e === 'on:error')
    const offError = worker.listenerLog.filter(e => e === 'off:error')
    expect(onError.length, 'Error listener should be registered once').toBe(1)
    expect(offError.length, 'Error listener should be deregistered once').toBe(1)
  }
})

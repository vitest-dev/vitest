import type { WorkerRequest, WorkerResponse } from '../../../packages/vitest/src/node/pools/types'
import { expect, test } from 'vitest'
import { init } from '../../../packages/vitest/src/runtime/workers/init'

test('start delivered synchronously while registering the listener', async () => {
  const start = {
    __vitest_worker_request__: true,
    type: 'start',
    poolId: 1,
    workerId: 1,
    options: { reportMemory: false },
    context: {
      environment: { name: 'node', options: null },
      config: { name: 'test' },
      pool: 'custom',
    },
    traces: { enabled: false },
  } as unknown as WorkerRequest

  const responses: WorkerResponse[] = []
  let delivered: unknown

  init({
    on(callback) {
      delivered ??= callback(start)
    },
    post(response) {
      responses.push(response as WorkerResponse)
    },
  } as any)

  await delivered

  expect(responses).toEqual([{ type: 'started', __vitest_worker_response__: true }])
})

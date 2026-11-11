import type { BirpcOptions } from 'birpc'
import { describe, expect, test } from 'vitest'
import { createRuntimeRpc, rpcDone } from '../../../packages/vitest/src/runtime/rpc'

/**
 * A minimal main-process side of the RPC channel: it answers a request, and
 * a handler that never settles leaves the call pending, as a busy main process
 * does.
 */
function createMainSide(handle: (method: string) => Promise<unknown>) {
  let deliverToWorker: ((data: any) => void) | undefined

  const options: Pick<BirpcOptions<any>, 'on' | 'post'> = {
    on: (callback: (data: any) => void) => {
      deliverToWorker = callback
      return () => {
        deliverToWorker = undefined
      }
    },
    post: (data: any) => {
      if (data?.t !== 'q') {
        return
      }
      void handle(data.m).then(
        (result) => deliverToWorker?.({ t: 's', i: data.i, r: result }),
        (error) => deliverToWorker?.({ t: 's', i: data.i, e: error }),
      )
    },
  }

  return { worker: createRuntimeRpc(options as any) }
}

describe('rpcDone', () => {
  test('waits for a call that is still pending, even when another call failed', async () => {
    let releaseSlowCall!: () => void
    const slowCall = new Promise<void>((resolve) => {
      releaseSlowCall = resolve
    })

    const { worker } = createMainSide((method) => {
      if (method === 'onTaskUpdate') {
        return slowCall
      }
      return Promise.reject(new Error('module fetch failed'))
    })

    // The failing call is handled here, so it does not surface on its own.
    const failing = worker.onCollected([]).catch(() => 'failed')
    const slow = worker.onTaskUpdate([], [])

    let settled = false
    const donePromise = rpcDone().finally(() => {
      settled = true
    })

    await failing
    await Promise.resolve()

    // The failing call settled, but the slow one has not. `rpcDone` must not
    // settle while a call is still in flight, or the teardown that follows
    // rejects it with an `EnvironmentTeardownError` that nobody handles.
    expect(settled).toBe(false)

    releaseSlowCall()
    await slow
    await donePromise.catch(() => {})

    expect(settled).toBe(true)
  })

  test('rejects with the error of a failed call, after every call settled', async () => {
    const { worker } = createMainSide(() => Promise.reject(new Error('module fetch failed')))

    const failing = worker.onCollected([]).catch(() => 'failed')

    // `rpcDone` is called while the call is still in flight, the way the
    // worker does it when it tears down.
    const donePromise = rpcDone()
    await failing

    await expect(donePromise).rejects.toThrow('module fetch failed')
  })

  test('resolves when no call is in flight', async () => {
    await expect(rpcDone()).resolves.toBeUndefined()
  })
})

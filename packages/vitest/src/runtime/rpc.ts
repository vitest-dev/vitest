import type { BirpcOptions, BirpcReturn } from 'birpc'
import type { RunnerRPC, RuntimeRPC } from '../types/rpc'
import type { WorkerRPC } from '../types/worker'
import type { CancelReason } from './runner/types'
import { getSafeTimers } from '@vitest/utils/timers'
import { createBirpc } from 'birpc'
import { getWorkerState } from './utils'

const { get } = Reflect

function withSafeTimers(fn: () => void) {
  const { setTimeout, clearTimeout, nextTick, setImmediate, clearImmediate }
    = getSafeTimers()

  const currentSetTimeout = globalThis.setTimeout
  const currentClearTimeout = globalThis.clearTimeout
  const currentSetImmediate = globalThis.setImmediate
  const currentClearImmediate = globalThis.clearImmediate

  const currentNextTick = globalThis.process?.nextTick

  try {
    globalThis.setTimeout = setTimeout
    globalThis.clearTimeout = clearTimeout

    if (setImmediate) {
      globalThis.setImmediate = setImmediate
    }
    if (clearImmediate) {
      globalThis.clearImmediate = clearImmediate
    }

    if (globalThis.process && nextTick) {
      globalThis.process.nextTick = nextTick
    }

    const result = fn()
    return result
  }
  finally {
    globalThis.setTimeout = currentSetTimeout
    globalThis.clearTimeout = currentClearTimeout
    globalThis.setImmediate = currentSetImmediate
    globalThis.clearImmediate = currentClearImmediate

    if (globalThis.process && nextTick) {
      nextTick(() => {
        globalThis.process.nextTick = currentNextTick
      })
    }
  }
}

const promises = new Set<Promise<unknown>>()
const pendingRpcArgs = new WeakMap<WorkerRPC, Map<string, unknown[][]>>()

export function getPendingRpcArgs(rpc: WorkerRPC, method: string): unknown[] | undefined {
  const calls = pendingRpcArgs.get(rpc)?.get(method)
  return calls?.[calls.length - 1]
}

export async function rpcDone(): Promise<unknown[] | undefined> {
  if (!promises.size) {
    return
  }
  const awaitable = Array.from(promises)
  return Promise.all(awaitable)
}

const onCancelCallbacks: ((reason: CancelReason) => void)[] = []

export function onCancel(callback: (reason: CancelReason) => void): () => void {
  onCancelCallbacks.push(callback)
  return () => {
    const index = onCancelCallbacks.indexOf(callback)
    if (index !== -1) {
      onCancelCallbacks.splice(index, 1)
    }
  }
}

export function createRuntimeRpc(
  options: Pick<
    BirpcOptions<RuntimeRPC>,
    'on' | 'post' | 'serialize' | 'deserialize'
  >,
): WorkerRPC {
  const pendingCalls = new Map<string, unknown[][]>()

  const rpc = createSafeRpc(
    createBirpc<RuntimeRPC, RunnerRPC>(
      {
        async onCancel(reason) {
          await Promise.all(onCancelCallbacks.map(fn => fn(reason)))
        },
      },
      {
        eventNames: [
          'onCancel',
        ],
        timeout: -1,
        ...options,
      },
    ),
    pendingCalls,
  )

  pendingRpcArgs.set(rpc, pendingCalls)
  return rpc
}

function createSafeRpc(rpc: WorkerRPC, pendingCalls: Map<string, unknown[][]>): WorkerRPC {
  return new Proxy(rpc, {
    get(target, p, handler) {
      // keep $rejectPendingCalls as sync function
      if (p === '$rejectPendingCalls') {
        return rpc.$rejectPendingCalls
      }

      const sendCall = get(target, p, handler)
      const safeSendCall = (...args: any[]) =>
        withSafeTimers(async () => {
          const method = 'onUserConsoleLog'
          const calls = p === method ? pendingCalls.get(method) || [] : undefined
          if (calls) {
            calls.push(args)
            pendingCalls.set(method, calls)
          }

          try {
            const result = sendCall(...args)
            promises.add(result)
            try {
              return await result
            }
            finally {
              promises.delete(result)
            }
          }
          finally {
            if (calls) {
              const index = calls.indexOf(args)
              if (index !== -1) {
                calls.splice(index, 1)
              }
              if (!calls.length) {
                pendingCalls.delete(method)
              }
            }
          }
        })
      safeSendCall.asEvent = sendCall.asEvent
      return safeSendCall
    },
  })
}

export function rpc(): BirpcReturn<RuntimeRPC, RunnerRPC> {
  const { rpc } = getWorkerState()
  return rpc
}

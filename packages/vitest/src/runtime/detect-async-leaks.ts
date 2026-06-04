import type { AsyncLeak } from '../types/general'
import { createHook } from 'node:async_hooks'

interface PossibleLeak extends AsyncLeak {
  isActive: () => boolean
}

const IGNORED_TYPES = new Set([
  'DNSCHANNEL',
  'ELDHISTOGRAM',
  'PerformanceObserver',
  'RANDOMBYTESREQUEST',
  'SIGNREQUEST',
  'STREAM_END_OF_STREAM',
  'TCPWRAP',
  'TIMERWRAP',
  'TLSWRAP',
  'ZLIB',
])

export function detectAsyncLeaks(testFile: string, projectName: string): () => Promise<AsyncLeak[]> {
  const resources = new Map<number, PossibleLeak>()

  const hook = createHook({
    init(asyncId, type, triggerAsyncId, resource) {
      if (IGNORED_TYPES.has(type)) {
        return
      }

      let stack = ''
      const limit = Error.stackTraceLimit

      // VitestModuleEvaluator's async wrapper of node:vm causes out-of-bound stack traces, simply skip it.
      // Crash fixed in https://github.com/vitejs/vite/pull/21585
      try {
        Error.stackTraceLimit = 100
        stack = new Error('VITEST_DETECT_ASYNC_LEAKS').stack || ''
      }
      catch {
        return
      }
      finally {
        Error.stackTraceLimit = limit
      }

      if (!stack.includes(testFile)) {
        const trigger = resources.get(triggerAsyncId)

        if (!trigger) {
          return
        }

        stack = trigger.stack
      }

      let isActive = isActiveDefault

      if ('hasRef' in resource) {
        const ref = new WeakRef(resource as { hasRef: () => boolean })

        isActive = () => ref.deref()?.hasRef() ?? false
      }

      resources.set(asyncId, { type, stack, projectName, filename: testFile, isActive })
    },
    destroy(asyncId) {
      if (resources.get(asyncId)?.type !== 'PROMISE') {
        resources.delete(asyncId)
      }
    },
    promiseResolve(asyncId) {
      resources.delete(asyncId)
    },
  })

  hook.enable()

  return async function collect() {
    await Promise.resolve(setImmediate)

    hook.disable()

    const leaks = []

    for (const resource of resources.values()) {
      if (resource.isActive()) {
        leaks.push({
          stack: resource.stack,
          type: resource.type,
          filename: resource.filename,
          projectName: resource.projectName,
        })
      }
    }

    resources.clear()

    return leaks
  }
}

function isActiveDefault() {
  return true
}

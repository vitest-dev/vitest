import { createHook } from 'node:async_hooks'

interface Leak {
  type: string
  stack: string
  filename: string
  isActive: () => boolean
}

const IGNORED_TYPES = new Set([
  'DNSCHANNEL',
  'ELDHISTOGRAM',
  'PerformanceObserver',
  'PROMISE',
  'RANDOMBYTESREQUEST',
  'SIGNREQUEST',
  'TCPWRAP',
  'TIMERWRAP',
  'TLSWRAP',
  'ZLIB',
])

export function detectAsyncLeaks(testFile: string): () => Promise<Omit<Leak, 'isActive'>[]> {
  const resources = new Map<number, Leak>()

  const hook = createHook({
    init(asyncId, type, _triggerAsyncId, resource) {
      if (IGNORED_TYPES.has(type)) {
        return
      }

      const stack = new Error('VITEST_DETECT_ASYNC_LEAKS').stack || ''

      if (!stack.includes(testFile)) {
        return
      }

      let isActive = isActiveDefault

      if ('hasRef' in resource) {
        const ref = new WeakRef(resource as { hasRef: () => boolean })

        isActive = () => ref.deref()?.hasRef() ?? false
      }

      resources.set(asyncId, { type, stack, filename: testFile, isActive })
    },
    destroy(asyncId) {
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

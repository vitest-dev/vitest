import { afterEach, describe, expect, it, vi } from 'vitest'
import { maybeCollectChromiumGarbage } from '../../../packages/vitest/src/node/pools/browser'

describe('maybeCollectChromiumGarbage', () => {
  const originalForce = process.env.VITEST_CHROMIUM_GC_FORCE

  afterEach(() => {
    if (originalForce === undefined) {
      delete process.env.VITEST_CHROMIUM_GC_FORCE
    } else {
      process.env.VITEST_CHROMIUM_GC_FORCE = originalForce
    }
  })

  it('skips the disk space threshold check when VITEST_CHROMIUM_GC_FORCE is set', async () => {
    process.env.VITEST_CHROMIUM_GC_FORCE = '1'
    const send = vi.fn(async () => {})
    const detach = vi.fn(async () => {})
    const getCDPSession = vi.fn(async () => ({ send, detach }))

    const project = {
      config: {
        isolate: true,
        browser: { name: 'chromium' },
      },
      browser: {
        provider: {
          name: 'playwright',
          getCDPSession,
        },
      },
    } as any

    await maybeCollectChromiumGarbage(project, 'session-1')

    expect(getCDPSession).toHaveBeenCalledWith('session-1')
    expect(send).toHaveBeenCalledWith('HeapProfiler.collectGarbage')
    expect(detach).toHaveBeenCalledTimes(1)
  })
})

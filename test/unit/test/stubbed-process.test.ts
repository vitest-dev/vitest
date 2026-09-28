import { beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest'

describe('undefined process', () => {
  // This has to be first test of the file to trigger rpc withSafeTimers race
  it('undefined process when importing file outside root', async () => {
    const realProcess = globalThis.process

    onTestFinished(async () => {
      globalThis.process = realProcess
    })

    globalThis.process = undefined as any

    const mod = await import('../../test-utils/fixtures/external-math')
    expect(mod.sum(2, 3)).toBe(5)
  })
})

describe('stubbed process', () => {
  beforeAll(() => {
    vi.stubGlobal('process', { badMock: true })

    return () => {
      vi.unstubAllGlobals()
    }
  })

  it('should not hang', () => {
    expect(1).toBe(1)
  })

  it('should not crash (#9173)', async () => {
    await import('./fixtures/increment')
  })

  it('should not hang', () => {
    vi.unstubAllGlobals()

    process.stdout.write = () => true
  })
})

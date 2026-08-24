import { describe, expect, it, vi } from 'vitest'
import { ModuleMocker } from '@vitest/mocker/browser'

describe('ModuleMocker.invalidate', () => {
  it('clears registry and calls interceptor invalidate even when mockedIds is empty', async () => {
    const interceptor = {
      invalidate: vi.fn(),
      register: vi.fn(),
    }
    const rpc = {
      invalidate: vi.fn(),
      resolveId: vi.fn(),
      resolveMock: vi.fn(),
    }
    const createMockInstance = vi.fn()
    const config = { root: '/' }

    const mocker = new ModuleMocker(interceptor as any, rpc as any, createMockInstance, config)

    await mocker.invalidate()

    expect(interceptor.invalidate).toHaveBeenCalledTimes(1)
    expect(rpc.invalidate).not.toHaveBeenCalled()
  })
})

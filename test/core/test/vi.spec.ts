/**
 * @vitest-environment jsdom
 */

import type { MockedFunction, MockedObject } from 'vitest'
import { describe, expect, test, vi } from 'vitest'

const expectType = <T>(obj: T) => obj

describe('testing vi utils', () => {
  test('global scope has variable', () => {
    const IntersectionObserverMock = vi.fn()
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
    expect(globalThis.IntersectionObserver).toBe(IntersectionObserverMock)
    expect(window.IntersectionObserver).toBe(IntersectionObserverMock)
    expect(IntersectionObserver).toBe(IntersectionObserverMock)
  })

  test('reseting modules', async () => {
    const mod1 = await import('../src/env')
    vi.resetModules()
    const mod2 = await import('../src/env')
    const mod3 = await import('../src/env')
    expect(mod1).not.toBe(mod2)
    expect(mod2).toBe(mod3)
  })

  test('reseting modules doesnt reset vitest', async () => {
    const v1 = await import('vitest')
    vi.resetModules()
    const v2 = await import('vitest')
    expect(v1).toBe(v2)
  })

  test('vi mocked', () => {
    expectType<MockedObject<{ bar: () => boolean }>>({
      bar: vi.fn(() => true),
    })
    expectType<MockedFunction<() => boolean>>(vi.fn(() => true))
    expectType<MockedFunction<() => boolean>>(vi.fn())
  })

  // TODO: it's unstable in CI, skip until resolved
  test.skip('loads unloaded module', async () => {
    let mod: any
    import('../src/timeout').then(m => mod = m)

    expect(mod).toBeUndefined()

    await vi.dynamicImportSettled()

    expect(mod).toBeDefined()
    expect(mod.timeout).toBe(100)
  })
})

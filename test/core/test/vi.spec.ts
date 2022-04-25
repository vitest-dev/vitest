/**
 * @vitest-environment jsdom
 */

import { describe, expect, test, vi } from 'vitest'

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
})

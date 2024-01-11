/**
 * @vitest-environment jsdom
 */

import type { MockedFunction, MockedObject } from 'vitest'
import { describe, expect, test, vi } from 'vitest'
import { getWorkerState } from '../../../packages/vitest/src/utils'

function expectType<T>(obj: T) {
  return obj
}

describe('testing vi utils', () => {
  test('global scope has variable', () => {
    const IntersectionObserverMock = vi.fn()
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
    expect(globalThis.IntersectionObserver).toBe(IntersectionObserverMock)
    expect(window.IntersectionObserver).toBe(IntersectionObserverMock)
    expect(IntersectionObserver).toBe(IntersectionObserverMock)
  })

  test('resetting modules', async () => {
    const mod1 = await import('../src/env')
    vi.resetModules()
    const mod2 = await import('../src/env')
    const mod3 = await import('../src/env')
    expect(mod1).not.toBe(mod2)
    expect(mod2).toBe(mod3)
  })

  test('resetting modules doesn\'t reset vitest', async () => {
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

  test('vi partial mocked', () => {
    interface FooBar {
      foo: () => void
      bar: () => boolean
      baz: string
    }

    type FooBarFactory = () => FooBar

    const mockFactory: FooBarFactory = vi.fn()

    vi.mocked(mockFactory, { partial: true }).mockReturnValue({
      foo: vi.fn(),
    })

    vi.mocked(mockFactory, { partial: true, deep: false }).mockReturnValue({
      bar: vi.fn(),
    })

    vi.mocked(mockFactory, { partial: true, deep: true }).mockReturnValue({
      baz: 'baz',
    })

    type FooBarAsyncFactory = () => Promise<FooBar>

    const mockFactoryAsync: FooBarAsyncFactory = vi.fn()

    vi.mocked(mockFactoryAsync, { partial: true }).mockResolvedValue({
      foo: vi.fn(),
    })

    vi.mocked(mockFactoryAsync, { partial: true, deep: false }).mockResolvedValue({
      bar: vi.fn(),
    })

    vi.mocked(mockFactoryAsync, { partial: true, deep: true }).mockResolvedValue({
      baz: 'baz',
    })
  })

  test('can change config', () => {
    const state = getWorkerState()
    expect(state.config.hookTimeout).toBe(10000)
    expect(state.config.clearMocks).toBe(false)
    vi.setConfig({ hookTimeout: 6000, clearMocks: true })
    expect(state.config.hookTimeout).toBe(6000)
    expect(state.config.clearMocks).toBe(true)
    vi.resetConfig()
    expect(state.config.hookTimeout).toBe(10000)
    expect(state.config.clearMocks).toBe(false)
  })

  test('loads unloaded module', async () => {
    let mod: any
    import('../src/timeout').then(m => mod = m)

    expect(mod).toBeUndefined()

    await vi.dynamicImportSettled()

    expect(mod).toBeDefined()
    expect(mod.timeout).toBe(100)
  })
})

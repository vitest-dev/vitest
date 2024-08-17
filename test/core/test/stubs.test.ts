/* eslint-disable vars-on-top */

import { beforeEach, describe, expect, it, vi } from 'vitest'

declare global {
  // eslint-disable-next-line no-var
  var __defined__: unknown
  // eslint-disable-next-line no-var
  var __setter__: unknown
}

describe('stubbing globals', () => {
  beforeEach(() => {
    delete globalThis.__defined__
    if (globalThis.__setter__) {
      delete globalThis.__setter__
    }
    vi.unstubAllGlobals()
  })

  it('overwrites setter', () => {
    const descriptor = {
      get: () => 'getter',
      set: () => {},
      configurable: true,
    }
    Object.defineProperty(globalThis, '__setter__', descriptor)
    expect(__setter__).toBe('getter')
    vi.stubGlobal('__setter__', 'stubbed')
    expect(__setter__).toBe('stubbed')
    expect(globalThis.__setter__).toBe('stubbed')
    expect(Object.getOwnPropertyDescriptor(globalThis, '__setter__')).not.toBe(descriptor)
    vi.unstubAllGlobals()
    expect(__setter__).toBe('getter')
  })

  it('stubs and restores already defined value', () => {
    globalThis.__defined__ = 'true'
    vi.stubGlobal('__defined__', 'false')
    expect(__defined__).toBe('false')
    expect(globalThis.__defined__).toBe('false')
    vi.unstubAllGlobals()
    expect(__defined__).toBe('true')
    expect(globalThis.__defined__).toBe('true')
  })

  it('stubs and removes undefined value', () => {
    vi.stubGlobal('__defined__', 'false')
    expect(__defined__).toBe('false')
    expect(globalThis.__defined__).toBe('false')
    vi.unstubAllGlobals()
    expect('__defined__' in globalThis).toBe(false)
    expect(() => __defined__).toThrowError(ReferenceError)
    expect(globalThis.__defined__).toBeUndefined()
  })

  it('restores the first available value', () => {
    globalThis.__defined__ = 'true'
    vi.stubGlobal('__defined__', 'false')
    vi.stubGlobal('__defined__', false)
    vi.stubGlobal('__defined__', null)
    expect(__defined__).toBe(null)
    expect(globalThis.__defined__).toBe(null)
    vi.unstubAllGlobals()
    expect(__defined__).toBe('true')
    expect(globalThis.__defined__).toBe('true')
  })
})

describe('stubbing envs', () => {
  beforeEach(() => {
    process.env.VITE_TEST_UPDATE_ENV = 'development'
    vi.unstubAllEnvs()
  })

  it('stubs and restores env', () => {
    vi.stubEnv('VITE_TEST_UPDATE_ENV', 'production')
    expect(import.meta.env.VITE_TEST_UPDATE_ENV).toBe('production')
    expect(process.env.VITE_TEST_UPDATE_ENV).toBe('production')
    vi.unstubAllEnvs()
    expect(import.meta.env.VITE_TEST_UPDATE_ENV).toBe('development')
    expect(process.env.VITE_TEST_UPDATE_ENV).toBe('development')
  })

  it('stubs and restores previously not defined env', () => {
    delete process.env.VITE_TEST_UPDATE_ENV
    vi.stubEnv('VITE_TEST_UPDATE_ENV', 'production')
    expect(import.meta.env.VITE_TEST_UPDATE_ENV).toBe('production')
    expect(process.env.VITE_TEST_UPDATE_ENV).toBe('production')
    vi.unstubAllEnvs()
    expect('VITE_TEST_UPDATE_ENV' in process.env).toBe(false)
    expect('VITE_TEST_UPDATE_ENV' in import.meta.env).toBe(false)
    expect(import.meta.env.VITE_TEST_UPDATE_ENV).toBeUndefined()
    expect(process.env.VITE_TEST_UPDATE_ENV).toBeUndefined()
  })

  it('restores the first available value', () => {
    globalThis.__defined__ = 'true'
    vi.stubEnv('VITE_TEST_UPDATE_ENV', 'production')
    vi.stubEnv('VITE_TEST_UPDATE_ENV', 'staging')
    vi.stubEnv('VITE_TEST_UPDATE_ENV', 'test')
    expect(import.meta.env.VITE_TEST_UPDATE_ENV).toBe('test')
    expect(process.env.VITE_TEST_UPDATE_ENV).toBe('test')
    vi.unstubAllEnvs()
    expect(import.meta.env.VITE_TEST_UPDATE_ENV).toBe('development')
    expect(process.env.VITE_TEST_UPDATE_ENV).toBe('development')
  })

  it.each(['PROD', 'DEV', 'SSR'] as const)('requires boolean for env.%s', (name) => {
    vi.stubEnv(name as 'PROD', false)
    expect(import.meta.env[name]).toBe(false)
    expect(process.env[name]).toBe('')

    vi.stubEnv(name as 'PROD', true)
    expect(import.meta.env[name]).toBe(true)
    expect(process.env[name]).toBe('1')

    // @ts-expect-error PROD, DEV, SSR expect a boolean
    vi.stubEnv(name as 'PROD', 'string')
    // @ts-expect-error PROD, DEV, SSR expect a boolean
    vi.stubEnv(name, 'string')
  })

  it('setting boolean casts the value to string', () => {
    // @ts-expect-error value should be a string
    vi.stubEnv('MY_TEST_ENV', true)
    expect(import.meta.env.MY_TEST_ENV).toBe('true')
  })

  it('stubs to undefined and restores env', () => {
    vi.stubEnv('VITE_TEST_UPDATE_ENV', undefined)
    expect(import.meta.env.VITE_TEST_UPDATE_ENV).toBeUndefined()
    expect(process.env.VITE_TEST_UPDATE_ENV).toBeUndefined()
    vi.unstubAllEnvs()
    expect(import.meta.env.VITE_TEST_UPDATE_ENV).toBe('development')
    expect(process.env.VITE_TEST_UPDATE_ENV).toBe('development')
  })
})

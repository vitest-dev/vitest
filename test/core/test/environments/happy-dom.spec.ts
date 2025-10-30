// @vitest-environment happy-dom

import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
})

test('fake timers don\'t fail when using empty config', () => {
  vi.useFakeTimers({})
})

test('global CSS is injected correctly', () => {
  expect(CSS).toBeDefined()
  expect(CSS.escape).toBeDefined()
  expect(CSS.supports).toBeDefined()
})

test('atob and btoa are available', () => {
  expect(atob('aGVsbG8gd29ybGQ=')).toBe('hello world')
  expect(btoa('hello world')).toBe('aGVsbG8gd29ybGQ=')
})

test('request doesn\'t fail when using absolute url because it supports it', () => {
  expect(() => {
    const _r = new Request('/api', { method: 'GET' })
  }).not.toThrow()
})

test('can pass down a simple form data', async () => {
  const formData = new FormData()
  formData.set('hello', 'world')

  await expect((async () => {
    const req = new Request('http://localhost:3000/', {
      method: 'POST',
      body: formData,
    })
    await req.formData()
  })()).resolves.not.toThrowError()
})

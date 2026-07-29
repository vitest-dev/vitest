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
  })()).resolves.not.toThrow()
})

test('innerWidth and matchMedia', () => {
  expect(window.innerWidth).toBe(1024)
  expect(window.matchMedia('(max-width: 100px)').matches).toBe(false)
  window.innerWidth = 50
  expect(window.matchMedia('(max-width: 100px)').matches).toBe(true)
})

test('readonly window assignment throws', ({ task }) => {
  // happy-dom's vmThreads setup returns Window as a Node VM context directly.
  // Node contextification reports this getter-only assignment as successful,
  // unlike the populateGlobal facade used by threads/forks.
  if (task.file.pool === 'vmThreads') {
    expect(() => {
      Object.assign(window, { navigator: {} })
    }).not.toThrow()
    return
  }

  expect(() => {
    Object.assign(window, { navigator: {} })
  }).toThrowErrorMatchingInlineSnapshot(
    `[TypeError: Cannot set property navigator of #<GlobalWindow> which has only a getter]`,
  )
})

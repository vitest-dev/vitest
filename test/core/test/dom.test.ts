/**
 * @vitest-environment jsdom
 */

/* eslint-disable vars-on-top */

import { expect, it, vi } from 'vitest'

declare global {
  // eslint-disable-next-line no-var
  var __property_jsdom: unknown
}

it('jsdom', () => {
  expect(window).toBeDefined()

  const dom = document.createElement('a')
  dom.href = 'https://vitest.dev'
  dom.textContent = '<Vitest>'

  expect(dom.outerHTML).toEqual('<a href="https://vitest.dev">&lt;Vitest&gt;</a>')
})

it('dispatchEvent doesn\'t throw', () => {
  const target = new EventTarget()
  const event = new Event('click')
  expect(() => target.dispatchEvent(event)).not.toThrow()
})

it('Image works as expected', () => {
  const img = new Image(100)

  expect(img.width).toBe(100)
})

it('defined on self/window are defined on global', () => {
  expect(self).toBeDefined()
  expect(window).toBeDefined()

  expect(self.__property_jsdom).not.toBeDefined()
  expect(window.__property_jsdom).not.toBeDefined()
  expect(globalThis.__property_jsdom).not.toBeDefined()

  globalThis.__property_jsdom = 'defined_value'

  expect(__property_jsdom).toBe('defined_value')
  expect(self.__property_jsdom).toBe('defined_value')
  expect(window.__property_jsdom).toBe('defined_value')
  expect(globalThis.__property_jsdom).toBe('defined_value')

  self.__property_jsdom = 'test_value'

  expect(__property_jsdom).toBe('test_value')
  expect(self.__property_jsdom).toBe('test_value')
  expect(window.__property_jsdom).toBe('test_value')
  expect(globalThis.__property_jsdom).toBe('test_value')

  window.__property_jsdom = 'new_value'

  expect(__property_jsdom).toBe('new_value')
  expect(self.__property_jsdom).toBe('new_value')
  expect(window.__property_jsdom).toBe('new_value')
  expect(globalThis.__property_jsdom).toBe('new_value')

  globalThis.__property_jsdom = 'global_value'

  expect(__property_jsdom).toBe('global_value')
  expect(self.__property_jsdom).toBe('global_value')
  expect(window.__property_jsdom).toBe('global_value')
  expect(globalThis.__property_jsdom).toBe('global_value')

  const obj = {}

  self.__property_jsdom = obj

  expect(self.__property_jsdom).toBe(obj)
  expect(window.__property_jsdom).toBe(obj)
  expect(globalThis.__property_jsdom).toBe(obj)
})

it('usage with defineProperty', () => {
  Object.defineProperty(self, '__property_jsdom', {
    get: () => 'self_property',
    configurable: true,
  })

  expect(__property_jsdom).toBe('self_property')
  expect(self.__property_jsdom).toBe('self_property')
  expect(globalThis.__property_jsdom).toBe('self_property')
  expect(window.__property_jsdom).toBe('self_property')

  Object.defineProperty(window, '__property_jsdom', {
    get: () => 'window_property',
    configurable: true,
  })

  expect(__property_jsdom).toBe('window_property')
  expect(self.__property_jsdom).toBe('window_property')
  expect(globalThis.__property_jsdom).toBe('window_property')
  expect(window.__property_jsdom).toBe('window_property')

  Object.defineProperty(globalThis, '__property_jsdom', {
    get: () => 'global_property',
    configurable: true,
  })

  expect(__property_jsdom).toBe('global_property')
  expect(self.__property_jsdom).toBe('global_property')
  expect(globalThis.__property_jsdom).toBe('global_property')
  expect(window.__property_jsdom).toBe('global_property')
})

it('can call global functions without window works as expected', async () => {
  const noop = vi.fn()

  expect(() => addEventListener('abort', noop)).not.toThrow()
  expect(() => requestAnimationFrame(noop)).not.toThrow()
  expect(() => window.requestAnimationFrame(noop)).not.toThrow()
  expect(() => self.requestAnimationFrame(noop)).not.toThrow()
  expect(() => globalThis.requestAnimationFrame(noop)).not.toThrow()
})

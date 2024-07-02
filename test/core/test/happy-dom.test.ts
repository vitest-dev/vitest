/**
 * @vitest-environment happy-dom
 */

/* eslint-disable vars-on-top */

import { expect, it, vi } from 'vitest'

declare global {
  // eslint-disable-next-line no-var
  var __property_dom: unknown
  // eslint-disable-next-line no-var
  var happyDOM: any
}

it('defaults URL to localhost:3000', () => {
  expect(location.href).toBe('http://localhost:3000/')
})

it('disableCSSFileLoading is false by default because we didn\'t change options', () => {
  expect(window.happyDOM?.settings.disableCSSFileLoading).toBe(false)
})

it('defined on self/window are defined on global', () => {
  expect(self).toBeDefined()
  expect(window).toBeDefined()
  expect(top).toBeDefined()
  expect(parent).toBeDefined()

  expect(self.__property_dom).not.toBeDefined()
  expect(window.__property_dom).not.toBeDefined()
  expect(globalThis.__property_dom).not.toBeDefined()

  globalThis.__property_dom = 'defined_value'

  expect(__property_dom).toBe('defined_value')
  expect(self.__property_dom).toBe('defined_value')
  expect(window.__property_dom).toBe('defined_value')
  expect(globalThis.__property_dom).toBe('defined_value')

  self.__property_dom = 'test_value'

  expect(__property_dom).toBe('test_value')
  expect(self.__property_dom).toBe('test_value')
  expect(window.__property_dom).toBe('test_value')
  expect(globalThis.__property_dom).toBe('test_value')

  window.__property_dom = 'new_value'

  expect(__property_dom).toBe('new_value')
  expect(self.__property_dom).toBe('new_value')
  expect(window.__property_dom).toBe('new_value')
  expect(globalThis.__property_dom).toBe('new_value')

  globalThis.__property_dom = 'global_value'

  expect(__property_dom).toBe('global_value')
  expect(self.__property_dom).toBe('global_value')
  expect(window.__property_dom).toBe('global_value')
  expect(globalThis.__property_dom).toBe('global_value')

  const obj = {}

  self.__property_dom = obj

  expect(self.__property_dom).toBe(obj)
  expect(window.__property_dom).toBe(obj)
  expect(globalThis.__property_dom).toBe(obj)
})

it('usage with defineProperty', () => {
  Object.defineProperty(self, '__property_dom', {
    get: () => 'self_property',
    configurable: true,
  })

  expect(__property_dom).toBe('self_property')
  expect(self.__property_dom).toBe('self_property')
  expect(globalThis.__property_dom).toBe('self_property')
  expect(window.__property_dom).toBe('self_property')

  Object.defineProperty(window, '__property_dom', {
    get: () => 'window_property',
    configurable: true,
  })

  expect(__property_dom).toBe('window_property')
  expect(self.__property_dom).toBe('window_property')
  expect(globalThis.__property_dom).toBe('window_property')
  expect(window.__property_dom).toBe('window_property')

  Object.defineProperty(globalThis, '__property_dom', {
    get: () => 'global_property',
    configurable: true,
  })

  expect(__property_dom).toBe('global_property')
  expect(self.__property_dom).toBe('global_property')
  expect(globalThis.__property_dom).toBe('global_property')
  expect(window.__property_dom).toBe('global_property')
})

it('can call global functions without window works as expected', async () => {
  const noop = vi.fn()

  expect(() => addEventListener('abort', noop)).not.toThrow()
  expect(() => scrollTo()).not.toThrow()
  expect(() => requestAnimationFrame(noop)).not.toThrow()
  expect(() => window.requestAnimationFrame(noop)).not.toThrow()
  expect(() => self.requestAnimationFrame(noop)).not.toThrow()
  expect(() => globalThis.requestAnimationFrame(noop)).not.toThrow()
})

it('globals are the same', () => {
  expect(window).toBe(globalThis)
  expect(window).toBe(global)
  expect(window.globalThis).toBe(globalThis)
  expect(window.Blob).toBe(globalThis.Blob)
  expect(window.globalThis.Blob).toBe(globalThis.Blob)
  expect(Blob).toBe(globalThis.Blob)
})

it.skipIf(import.meta.env.VITEST_VM_POOL)('default view references global object', () => {
  expect(document.defaultView).toBe(window)
  expect(document.defaultView).toBe(globalThis)
  const el = document.createElement('div')
  expect(el.ownerDocument.defaultView).toBe(globalThis)
})

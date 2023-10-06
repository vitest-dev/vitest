/* eslint-disable no-restricted-globals */

/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "https://example.com/" }
 */

/* eslint-disable vars-on-top */

import { expect, it, vi } from 'vitest'

declare global {
  // eslint-disable-next-line no-var
  var __property_jsdom: unknown
}

it('jsdom', () => {
  expect(window).toBeDefined()
  expect(top).toBeDefined()
  expect(parent).toBeDefined()
  expect(self).toBeDefined()
  expect(location.href).toBe('https://example.com/')

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

it('Non-public "live" keys work as expected', () => {
  const img = new Image(100)
  const audio = new Audio()
  const option = new Option()

  expect(img.width).toBe(100)
  expect(audio).toBeInstanceOf(window.Audio)
  expect(option).toBeInstanceOf(window.Option)
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

it('globals are the same', () => {
  expect(window).toBe(globalThis)
  expect(window).toBe(global)
  expect(window.globalThis).toBe(globalThis)
  expect(window.Blob).toBe(globalThis.Blob)
  expect(window.globalThis.Blob).toBe(globalThis.Blob)
  expect(Blob).toBe(globalThis.Blob)
  expect(document.defaultView).toBe(window)
  const el = document.createElement('div')
  expect(el.ownerDocument.defaultView).toBe(globalThis)
})

it('can extend global class', () => {
  class SuperBlob extends Blob {}

  expect(SuperBlob).toBeDefined()
})

it('uses jsdom ArrayBuffer', async () => {
  const blob = new Blob(['Hello'], { type: 'text/plain' })

  const arraybuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })

  expect(arraybuffer.constructor.name).toBe('ArrayBuffer')
  expect(arraybuffer instanceof ArrayBuffer).toBeTruthy()
  expect(arraybuffer.constructor === ArrayBuffer).toBeTruthy()
})

it.each([
  'Uint8Array',
  'Uint16Array',
  'Uint32Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Int32Array',
  'Int8Array',
  'Float32Array',
  'Float64Array',
] as const)('%s has buffer as ArrayBuffer', async (constructorName) => {
  const Constructor = globalThis[constructorName]
  const typedArray = new Constructor([1])
  expect(typedArray.constructor.name).toBe(constructorName)
  expect(typedArray instanceof Constructor).toBeTruthy()
  expect(ArrayBuffer.isView(typedArray)).toBeTruthy()
  expect(typedArray.buffer instanceof ArrayBuffer).toBeTruthy()
})

it('doesn\'t throw, if listening for error', () => {
  const spy = vi.fn((e: Event) => e.preventDefault())
  window.addEventListener('error', spy)
  addEventListener('custom', () => {
    throw new Error('some error')
  })
  dispatchEvent(new Event('custom'))
  expect(spy).toHaveBeenCalled()
})

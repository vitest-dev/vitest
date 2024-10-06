// @vitest-environment jsdom

import { stripVTControlCharacters } from 'node:util'
import { processError } from '@vitest/utils/error'
import { expect, test } from 'vitest'

const nodeMajor = Number(process.version.slice(1).split('.')[0])

test.runIf(nodeMajor >= 15)('MessageChannel and MessagePort are available', () => {
  expect(MessageChannel).toBeDefined()
  expect(MessagePort).toBeDefined()
})

test.runIf(nodeMajor >= 17)('structuredClone is available', () => {
  expect(structuredClone).toBeDefined()
})

test.runIf(nodeMajor >= 18)('fetch, Request, Response, and BroadcastChannel are available', () => {
  expect(fetch).toBeDefined()
  expect(Request).toBeDefined()
  expect(Response).toBeDefined()
  expect(TextEncoder).toBeDefined()
  expect(TextDecoder).toBeDefined()
  expect(BroadcastChannel).toBeDefined()
})

test('atob and btoa are available', () => {
  expect(atob('aGVsbG8gd29ybGQ=')).toBe('hello world')
  expect(btoa('hello world')).toBe('aGVsbG8gd29ybGQ=')
})

test('toContain correctly handles DOM nodes', () => {
  const wrapper = document.createElement('div')
  const child = document.createElement('div')
  const external = document.createElement('div')
  wrapper.appendChild(child)

  const parent = document.createElement('div')
  parent.appendChild(wrapper)
  parent.appendChild(external)

  document.body.appendChild(parent)
  const divs = document.querySelectorAll('div')

  expect(divs).toContain(wrapper)
  expect(divs).toContain(parent)
  expect(divs).toContain(external)

  expect(wrapper).toContain(child)
  expect(wrapper).not.toContain(external)

  wrapper.classList.add('flex', 'flex-col')

  expect(wrapper.classList).toContain('flex-col')
  expect(wrapper.classList).not.toContain('flex-row')

  expect(() => {
    expect(wrapper).toContain('some-element')
  }).toThrowErrorMatchingInlineSnapshot(`[TypeError: toContain() expected a DOM node as the argument, but got string]`)

  expect(() => {
    expect(wrapper.classList).toContain('flex-row')
  }).toThrowErrorMatchingInlineSnapshot(`[AssertionError: expected "flex flex-col" to contain "flex-row"]`)
  expect(() => {
    expect(wrapper.classList).toContain(2)
  }).toThrowErrorMatchingInlineSnapshot(`[TypeError: class name value must be string, received "number"]`)

  try {
    expect(wrapper.classList).toContain('flex-row')
    expect.unreachable()
  }
  catch (err: any) {
    expect(stripVTControlCharacters(processError(err).diff)).toMatchInlineSnapshot(`
      "Expected: "flex flex-col flex-row"
      Received: "flex flex-col""
    `)
  }

  try {
    expect(wrapper.classList).not.toContain('flex')
    expect.unreachable()
  }
  catch (err: any) {
    expect(stripVTControlCharacters(processError(err).diff)).toMatchInlineSnapshot(`
      "Expected: "flex-col"
      Received: "flex flex-col""
    `)
  }
})

test('request doesn\'t support absolute URL because jsdom doesn\'t provide compatible Request so Vitest is using Node.js Request', () => {
  expect(() => {
    const _r = new Request('/api', { method: 'GET' })
  }).toThrow(/Failed to parse URL/)
})

test('jsdom global is exposed', () => {
  // @ts-expect-error -- jsdom is not exposed in our types because we use a single tsconfig for all
  const dom = jsdom
  expect(dom).toBeDefined()
  dom.reconfigure({ url: 'https://examples.new.com' })
  expect(location.href).toBe('https://examples.new.com/')
})

test('ssr is disabled', () => {
  expect(import.meta.env.SSR).toBe(false)
})

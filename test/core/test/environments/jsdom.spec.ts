// @vitest-environment jsdom

import { setMaxListeners } from 'node:events'
import { stripVTControlCharacters } from 'node:util'
import { processError } from '@vitest/utils/error'
import { describe, expect, test, vi } from 'vitest'

test('MessageChannel and MessagePort are available', () => {
  expect(MessageChannel).toBeDefined()
  expect(MessagePort).toBeDefined()
})

test('structuredClone is available', () => {
  expect(structuredClone).toBeDefined()
})

test('fetch, Request, Response, and BroadcastChannel are available', () => {
  expect(fetch).toBeDefined()
  expect(Request).toBeDefined()
  expect(Response).toBeDefined()
  expect(TextEncoder).toBeDefined()
  expect(TextDecoder).toBeDefined()
  expect(BroadcastChannel).toBeDefined()
})

test('Fetch API accepts other APIs', async () => {
  expect.soft(() => new Request('http://localhost', { signal: new AbortController().signal })).not.toThrow()
  expect.soft(() => new Request('http://localhost', { method: 'POST', body: new FormData() })).not.toThrow()
  expect.soft(() => new Request('http://localhost', { method: 'POST', body: new Blob() })).not.toThrow()
  expect.soft(() => new Request(new URL('https://localhost'))).not.toThrow()

  const request = new Request('http://localhost')
  expect.soft(request.headers).toBeInstanceOf(Headers)

  expect.soft(
    () => new Request('http://localhost', { method: 'POST', body: new URLSearchParams([['key', 'value']]) }),
  ).not.toThrow()

  const searchParams = new URLSearchParams()
  searchParams.set('key', 'value')
  expect.soft(() => new Request('http://localhost', { method: 'POST', body: searchParams })).not.toThrow()

  const clone = request.clone()
  expect.soft(clone).toBeInstanceOf(Request)
})

test('fetch api doesnt override the init object', () => {
  const body = new FormData()
  const init: RequestInit = {
    method: 'post',
    body,
  }
  const _request = new Request('http://localhost', init)
  expect(init.body).toBe(body)
})

describe('FormData', () => {
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

  test('can pass down form data from a FORM element', async () => {
    const form = document.createElement('form')
    document.body.append(form)

    const hello = document.createElement('input')
    hello.value = 'world'
    hello.type = 'text'
    hello.name = 'hello'
    form.append(hello)

    const formData = new FormData(form)
    expect([...formData.entries()]).toEqual([
      ['hello', 'world'],
    ])

    await expect((async () => {
      const req = new Request('http://localhost:3000/', {
        method: 'POST',
        body: formData,
      })
      await req.formData()
    })()).resolves.not.toThrow()
  })

  test('can pass down form data from a FORM element with a submitter', async () => {
    const form = document.createElement('form')
    document.body.append(form)

    const hello = document.createElement('input')
    hello.value = 'world'
    hello.type = 'text'
    hello.name = 'hello'
    form.append(hello)

    const submitter = document.createElement('button')
    submitter.type = 'submit'
    submitter.name = 'include'
    submitter.value = 'submitter'
    form.append(submitter)

    const formData = new FormData(form, submitter)
    expect([...formData.entries()]).toEqual([
      ['hello', 'world'],
      ['include', 'submitter'],
    ])

    await expect((async () => {
      const req = new Request('http://localhost:3000/', {
        method: 'POST',
        body: formData,
      })
      await req.formData()
    })()).resolves.not.toThrow()
  })

  // https://developer.mozilla.org/en-US/docs/Web/API/FormData/FormData#exceptions
  test('cannot pass down form data from a FORM element with a non-sumbit sumbitter', async () => {
    const form = document.createElement('form')
    document.body.append(form)
    const submitter = document.createElement('button')
    submitter.type = 'button'
    form.append(submitter)

    expect(() => new FormData(form, submitter)).toThrow(
      new TypeError('The specified element is not a submit button'),
    )
  })

  test('cannot pass down form data from a FORM element with a sumbitter from a wrong form', async () => {
    const form1 = document.createElement('form')
    const form2 = document.createElement('form')
    document.body.append(form1, form2)
    const submitter = document.createElement('button')
    submitter.type = 'submit'
    form2.append(submitter)

    try {
      // can't use toThrow here because DOMException is not an Error
      const _ = new FormData(form1, submitter)
    }
    catch (error: any) {
      const expectedError = new DOMException(
        'The specified element is not owned by this form element',
        'NotFoundError',
      )
      expect(error).toEqual(expectedError)
    }
  })

  test('supports Blob', () => {
    const form = new FormData()
    const key = 'prop'

    const data = new Blob()

    form.set(key, data)

    const retrievedBlob = form.get(key)

    expect(retrievedBlob).toBeInstanceOf(Blob)
  })

  test('supports File', () => {
    const form = new FormData()
    const key = 'prop'

    const data = new File([], 'name')

    form.set(key, data)

    const retrievedBlob = form.get(key)

    expect(retrievedBlob).toBeInstanceOf(File)
  })
})

test('DOM APIs accept AbortController', () => {
  const element = document.createElement('div')
  document.body.append(element)
  const controller = new AbortController()
  const spy = vi.fn()
  element.addEventListener('click', spy, {
    signal: controller.signal,
  })

  element.click()

  expect(spy).toHaveBeenCalledTimes(1)

  controller.abort()

  element.click()

  expect(spy).toHaveBeenCalledTimes(1)
})

test('can pass down the same abort signal many times without a warning', ({ onTestFinished }) => {
  const controller = new AbortController()
  const signal = controller.signal
  setMaxListeners(5, signal)

  const emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {})
  onTestFinished(() => emitWarning.mockRestore())

  const element = document.createElement('div')
  document.body.append(element)

  for (let i = 0; i < 20; i++) {
    element.addEventListener('click', () => {}, {
      signal,
    })
  }

  expect(emitWarning).not.toHaveBeenCalledWith(expect.objectContaining({
    message: expect.stringContaining('Possible EventTarget memory leak detected.'),
  }))
})

test('DOM APIs addEventListener allow null as third parameter', () => {
  const element = document.createElement('div')
  document.body.append(element)
  const spy = vi.fn()

  // eslint-disable-next-line ts/ban-ts-comment
  // @ts-expect-error
  element.addEventListener('click', spy, null)

  element.click()

  expect(spy).toHaveBeenCalledTimes(1)
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
    expect(stripVTControlCharacters(processError(err).diff!)).toMatchInlineSnapshot(`
      "Expected: "flex flex-col flex-row"
      Received: "flex flex-col""
    `)
  }

  try {
    expect(wrapper.classList).not.toContain('flex')
    expect.unreachable()
  }
  catch (err: any) {
    expect(stripVTControlCharacters(processError(err).diff!)).toMatchInlineSnapshot(`
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

test('URL.createObjectUrl works properly', () => {
  expect(() => {
    URL.createObjectURL(new Blob())
  }).not.toThrow()
  expect(() => {
    URL.createObjectURL(new File([], 'name.js'))
  }).not.toThrow()
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

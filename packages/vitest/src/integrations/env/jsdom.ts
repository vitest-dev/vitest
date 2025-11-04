import type { DOMWindow } from 'jsdom'
import type { NodeBlob } from 'node:buffer'
import type { Environment } from '../../types/environment'
import type { JSDOMOptions } from '../../types/jsdom-options'
import { URL as NodeURL } from 'node:url'
import { populateGlobal } from './utils'

function catchWindowErrors(window: DOMWindow) {
  let userErrorListenerCount = 0
  function throwUnhandlerError(e: ErrorEvent) {
    if (userErrorListenerCount === 0 && e.error != null) {
      e.preventDefault()
      process.emit('uncaughtException', e.error)
    }
  }
  const addEventListener = window.addEventListener.bind(window)
  const removeEventListener = window.removeEventListener.bind(window)
  window.addEventListener('error', throwUnhandlerError)
  window.addEventListener = function (
    ...args: [any, any, any]
  ) {
    if (args[0] === 'error') {
      userErrorListenerCount++
    }
    return addEventListener.apply(this, args)
  }
  window.removeEventListener = function (
    ...args: [any, any, any]
  ) {
    if (args[0] === 'error' && userErrorListenerCount) {
      userErrorListenerCount--
    }
    return removeEventListener.apply(this, args)
  }
  return function clearErrorHandlers() {
    window.removeEventListener('error', throwUnhandlerError)
  }
}

let NodeFormData_!: typeof FormData
let NodeBlob_!: typeof NodeBlob

export default <Environment>{
  name: 'jsdom',
  viteEnvironment: 'client',
  async setupVM({ jsdom = {} }) {
    // delay initialization because it takes ~1s
    NodeFormData_ = globalThis.FormData
    NodeBlob_ = globalThis.Blob as typeof NodeBlob

    const { CookieJar, JSDOM, ResourceLoader, VirtualConsole } = await import(
      'jsdom',
    )
    const {
      html = '<!DOCTYPE html>',
      userAgent,
      url = 'http://localhost:3000',
      contentType = 'text/html',
      pretendToBeVisual = true,
      includeNodeLocations = false,
      runScripts = 'dangerously',
      resources,
      console = false,
      cookieJar = false,
      ...restOptions
    } = jsdom as JSDOMOptions
    let dom = new JSDOM(html, {
      pretendToBeVisual,
      resources:
        resources
        ?? (userAgent ? new ResourceLoader({ userAgent }) : undefined),
      runScripts,
      url,
      virtualConsole:
        console && globalThis.console
          ? new VirtualConsole().sendTo(globalThis.console)
          : undefined,
      cookieJar: cookieJar ? new CookieJar() : undefined,
      includeNodeLocations,
      contentType,
      userAgent,
      ...restOptions,
    })

    const clearAddEventListenerPatch = patchAddEventListener(dom.window)

    const clearWindowErrors = catchWindowErrors(dom.window)

    const utils = createCompatUtils(dom.window)

    // TODO: browser doesn't expose Buffer, but a lot of dependencies use it
    dom.window.Buffer = Buffer
    dom.window.jsdom = dom
    dom.window.FormData = createFormData(dom.window, utils)
    dom.window.URL = createJSDOMCompatURL(utils)

    // inject web globals if they are missing in JSDOM but otherwise available in Nodejs
    // https://nodejs.org/dist/latest/docs/api/globals.html
    const globalNames = [
      'structuredClone',
      'BroadcastChannel',
      'MessageChannel',
      'MessagePort',
      'TextEncoder',
      'TextDecoder',
    ] as const
    for (const name of globalNames) {
      const value = globalThis[name]
      if (
        typeof value !== 'undefined'
        && typeof dom.window[name] === 'undefined'
      ) {
        dom.window[name] = value
      }
    }

    // since we are providing Node.js's Fetch API,
    // we also should override other APIs they use
    const overrideGlobals = [
      'fetch',
      'Request',
      'Response',
      'Headers',
      'AbortController',
      'AbortSignal',
      'URLSearchParams',
      // URL is overriden with a compat one
      // 'URL',
    ] as const
    for (const name of overrideGlobals) {
      const value = globalThis[name]
      if (typeof value !== 'undefined') {
        dom.window[name] = value as any
      }
    }

    return {
      getVmContext() {
        return dom.getInternalVMContext()
      },
      teardown() {
        clearAddEventListenerPatch()
        clearWindowErrors()
        dom.window.close()
        dom = undefined as any
      },
    }
  },
  async setup(global, { jsdom = {} }) {
    // delay initialization because it takes ~1s
    NodeFormData_ = globalThis.FormData
    NodeBlob_ = globalThis.Blob as typeof NodeBlob

    const { CookieJar, JSDOM, ResourceLoader, VirtualConsole } = await import(
      'jsdom',
    )
    const {
      html = '<!DOCTYPE html>',
      userAgent,
      url = 'http://localhost:3000',
      contentType = 'text/html',
      pretendToBeVisual = true,
      includeNodeLocations = false,
      runScripts = 'dangerously',
      resources,
      console = false,
      cookieJar = false,
      ...restOptions
    } = jsdom as any
    const dom = new JSDOM(html, {
      pretendToBeVisual,
      resources:
        resources
        ?? (userAgent ? new ResourceLoader({ userAgent }) : undefined),
      runScripts,
      url,
      virtualConsole:
        console && global.console
          ? new VirtualConsole().sendTo(global.console)
          : undefined,
      cookieJar: cookieJar ? new CookieJar() : undefined,
      includeNodeLocations,
      contentType,
      userAgent,
      ...restOptions,
    })

    const clearAddEventListenerPatch = patchAddEventListener(dom.window)

    const { keys, originals } = populateGlobal(global, dom.window, {
      bindFunctions: true,
    })

    const clearWindowErrors = catchWindowErrors(global)
    const utils = createCompatUtils(dom.window)

    global.jsdom = dom
    global.FormData = createFormData(dom.window, utils)
    global.URL = createJSDOMCompatURL(utils)

    return {
      teardown(global) {
        clearAddEventListenerPatch()
        clearWindowErrors()
        dom.window.close()
        delete global.jsdom
        keys.forEach(key => delete global[key])
        originals.forEach((v, k) => (global[k] = v))
      },
    }
  },
}

// Node.js 24 has a global FormData that Request accepts
// FormData is not used anywhere else in JSDOM, so we can safely
// override it with Node.js implementation, but keep the DOM behaviour
// this is required because Request (and other fetch API)
// are not implemented by JSDOM
function createFormData(window: DOMWindow, utils: CompatUtils) {
  const JSDOMFormData = window.FormData
  if (!NodeFormData_) {
    return JSDOMFormData
  }

  return class FormData extends NodeFormData_ {
    constructor(...args: any[]) {
      super()
      const formData = new JSDOMFormData(...args)
      formData.forEach((value, key) => {
        this.append(key, value)
      })
    }

    set(...args: [name: string, blobValue: unknown, filename?: string]) {
      if (args[1] instanceof window.Blob) {
        args[1] = utils.makeCompatBlob(args[1] as NodeBlob)
      }
      return super.set(...args as [string, string])
    }

    append(...args: [name: string, blobValue: unknown, filename?: string]) {
      if (args[1] instanceof window.Blob) {
        args[1] = utils.makeCompatBlob(args[1] as NodeBlob)
      }
      return super.append(...args as [string, string])
    }
  }
}

function createJSDOMCompatURL(utils: CompatUtils): typeof URL {
  return class URL extends NodeURL {
    static createObjectURL(blob: NodeBlob): string {
      const compatBlob = utils.makeCompatBlob(blob)
      return NodeURL.createObjectURL(compatBlob)
    }
  } as typeof URL
}

interface CompatUtils {
  makeCompatBlob: (blob: NodeBlob) => NodeBlob
}

function createCompatUtils(window: DOMWindow): CompatUtils {
  // this returns a hidden Symbol(impl)
  // this is cursed, and jsdom should just implement fetch API itself
  const implSymbol = Object.getOwnPropertySymbols(
    Object.getOwnPropertyDescriptors(new window.Blob()),
  )[0]
  return {
    makeCompatBlob(blob: NodeBlob) {
      if (blob instanceof window.Blob) {
        const buffer = (blob as any)[implSymbol]._buffer
        return new NodeBlob_([buffer], { type: blob.type })
      }
      return blob
    },
  }
}

function patchAddEventListener(window: DOMWindow) {
  const JSDOMAbortSignal = window.AbortSignal
  const JSDOMAbortController = window.AbortController
  const originalAddEventListener = window.EventTarget.prototype.addEventListener

  window.EventTarget.prototype.addEventListener = function addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ) {
    if (typeof options === 'object' && options.signal != null) {
      const { signal, ...otherOptions } = options
      // - this happens because AbortSignal is provided by Node.js,
      // but jsdom APIs require jsdom's AbortSignal, while Node APIs
      // (like fetch and Request) require a Node.js AbortSignal
      // - disable narrow typing with "as any" because we need it later
      if (!((signal as any) instanceof JSDOMAbortSignal)) {
        const jsdomCompatOptions = Object.create(null)
        Object.assign(jsdomCompatOptions, otherOptions)

        // use jsdom-native abort controller instead and forward the
        // previous one with `addEventListener`
        const jsdomAbortController = new JSDOMAbortController()
        signal.addEventListener('abort', () => {
          jsdomAbortController.abort(signal.reason)
        })

        jsdomCompatOptions.signal = jsdomAbortController.signal
        return originalAddEventListener.call(this, type, callback, jsdomCompatOptions)
      }
    }

    return originalAddEventListener.call(this, type, callback, options)
  }

  return () => {
    window.EventTarget.prototype.addEventListener = originalAddEventListener
  }
}

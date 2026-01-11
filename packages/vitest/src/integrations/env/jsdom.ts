import type { DOMWindow, VirtualConsole as IVirtualConsole } from 'jsdom'
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
let NodeBlob_!: typeof Blob
let NodeRequest_!: typeof Request

export default <Environment>{
  name: 'jsdom',
  viteEnvironment: 'client',
  async setupVM({ jsdom = {} }) {
    // delay initialization because it takes ~1s
    NodeFormData_ = globalThis.FormData
    NodeBlob_ = globalThis.Blob
    NodeRequest_ = globalThis.Request

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
    let virtualConsole: IVirtualConsole | undefined
    if (console && globalThis.console) {
      virtualConsole = new VirtualConsole()
      // jsdom <27
      if ('sendTo' in virtualConsole) {
        (virtualConsole.sendTo as any)(globalThis.console)
      }
      // jsdom >=27
      else {
        virtualConsole.forwardTo(globalThis.console)
      }
    }
    let dom = new JSDOM(html, {
      pretendToBeVisual,
      resources:
        resources
        ?? (userAgent ? new ResourceLoader({ userAgent }) : undefined),
      runScripts,
      url,
      virtualConsole,
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
    dom.window.Request = createCompatRequest(utils)
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
      'Response',
      'Headers',
      'AbortController',
      'AbortSignal',
      'URLSearchParams',
      // URL and Request is overriden with a compat one
      // 'URL',
      // 'Request',
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
    NodeBlob_ = globalThis.Blob
    NodeRequest_ = globalThis.Request

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
    let virtualConsole: IVirtualConsole | undefined
    if (console && globalThis.console) {
      virtualConsole = new VirtualConsole()
      // jsdom <27
      if ('sendTo' in virtualConsole) {
        (virtualConsole.sendTo as any)(globalThis.console)
      }
      // jsdom >=27
      else {
        virtualConsole.forwardTo(globalThis.console)
      }
    }
    const dom = new JSDOM(html, {
      pretendToBeVisual,
      resources:
        resources
        ?? (userAgent ? new ResourceLoader({ userAgent }) : undefined),
      runScripts,
      url,
      virtualConsole,
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
    global.Request = createCompatRequest(utils)
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

function createCompatRequest(utils: CompatUtils) {
  return class Request extends NodeRequest_ {
    constructor(...args: [input: RequestInfo, init?: RequestInit]) {
      const [input, init] = args
      if (init?.body != null) {
        const compatInit = { ...init }
        if (init.body instanceof utils.window.Blob) {
          compatInit.body = utils.makeCompatBlob(init.body as any) as any
        }
        if (init.body instanceof utils.window.FormData) {
          compatInit.body = utils.makeCompatFormData(init.body)
        }
        super(input, compatInit)
      }
      else {
        super(...args)
      }
    }

    static [Symbol.hasInstance](instance: unknown): boolean {
      return instance instanceof NodeRequest_
    }
  }
}

function createJSDOMCompatURL(utils: CompatUtils): typeof URL {
  return class URL extends NodeURL {
    static createObjectURL(blob: any): string {
      if (blob instanceof utils.window.Blob) {
        const compatBlob = utils.makeCompatBlob(blob)
        return NodeURL.createObjectURL(compatBlob as any)
      }
      return NodeURL.createObjectURL(blob)
    }

    static [Symbol.hasInstance](instance: unknown): boolean {
      return instance instanceof NodeURL
    }
  } as typeof URL
}

interface CompatUtils {
  window: DOMWindow
  makeCompatBlob: (blob: Blob) => Blob
  makeCompatFormData: (formData: FormData) => FormData
}

function createCompatUtils(window: DOMWindow): CompatUtils {
  // this returns a hidden Symbol(impl)
  // this is cursed, and jsdom should just implement fetch API itself
  const implSymbol = Object.getOwnPropertySymbols(
    Object.getOwnPropertyDescriptors(new window.Blob()),
  )[0]
  const utils = {
    window,
    makeCompatFormData(formData: FormData) {
      const nodeFormData = new NodeFormData_()
      formData.forEach((value, key) => {
        if (value instanceof window.Blob) {
          nodeFormData.append(key, utils.makeCompatBlob(value as any) as any)
        }
        else {
          nodeFormData.append(key, value)
        }
      })
      return nodeFormData
    },
    makeCompatBlob(blob: Blob) {
      const buffer = (blob as any)[implSymbol]._buffer
      return new NodeBlob_([buffer], { type: blob.type })
    },
  }
  return utils
}

function patchAddEventListener(window: DOMWindow) {
  const abortControllers = new WeakMap<AbortSignal, AbortController>()
  const JSDOMAbortSignal = window.AbortSignal
  const JSDOMAbortController = window.AbortController
  const originalAddEventListener = window.EventTarget.prototype.addEventListener

  function getJsdomAbortController(signal: AbortSignal) {
    if (!abortControllers.has(signal)) {
      const jsdomAbortController = new JSDOMAbortController()
      signal.addEventListener('abort', () => {
        jsdomAbortController.abort(signal.reason)
      })
      abortControllers.set(signal, jsdomAbortController)
    }
    return abortControllers.get(signal)!
  }

  window.EventTarget.prototype.addEventListener = function addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ) {
    if (typeof options === 'object' && options?.signal != null) {
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
        const jsdomAbortController = getJsdomAbortController(signal)

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

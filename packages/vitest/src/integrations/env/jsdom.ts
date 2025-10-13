import type { Environment } from '../../types/environment'
import type { JSDOMOptions } from '../../types/jsdom-options'
import { populateGlobal } from './utils'

function catchWindowErrors(window: Window) {
  let userErrorListenerCount = 0
  function throwUnhandlerError(e: ErrorEvent) {
    if (userErrorListenerCount === 0 && e.error != null) {
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

export default <Environment>{
  name: 'jsdom',
  viteEnvironment: 'client',
  async setupVM({ jsdom = {} }) {
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
    const clearWindowErrors = catchWindowErrors(dom.window as any)

    // TODO: browser doesn't expose Buffer, but a lot of dependencies use it
    dom.window.Buffer = Buffer
    dom.window.jsdom = dom

    // inject web globals if they missing in JSDOM but otherwise available in Nodejs
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
      'URL',
      'URLSearchParams',
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
        clearWindowErrors()
        dom.window.close()
        dom = undefined as any
      },
    }
  },
  async setup(global, { jsdom = {} }) {
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

    const originalAddEventListener = dom.window.EventTarget.prototype.addEventListener

    dom.window.EventTarget.prototype.addEventListener = function addEventListener(
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
        if (!((signal as any) instanceof dom.window.AbortSignal)) {
          const jsdomCompatOptions = Object.create(null)
          Object.assign(jsdomCompatOptions, otherOptions)

          // use jsdom-native abort controller instead and forward the
          // previous one with `addEventListener`
          const jsdomAbortController = new dom.window.AbortController()
          signal.addEventListener('abort', () => {
            jsdomAbortController.abort(signal.reason)
          })

          jsdomCompatOptions.signal = jsdomAbortController.signal
          return originalAddEventListener.call(this, type, callback, jsdomCompatOptions)
        }
      }

      return originalAddEventListener.call(this, type, callback, options)
    }

    const { keys, originals } = populateGlobal(global, dom.window, {
      bindFunctions: true,
    })

    const clearWindowErrors = catchWindowErrors(global)

    global.jsdom = dom

    return {
      teardown(global) {
        clearWindowErrors()
        dom.window.close()
        delete global.jsdom
        keys.forEach(key => delete global[key])
        originals.forEach((v, k) => (global[k] = v))
      },
    }
  },
}

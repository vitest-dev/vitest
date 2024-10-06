import type { Environment } from '../../types/environment'
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
  transformMode: 'web',
  async setupVM({ jsdom = {} }) {
    const { CookieJar, JSDOM, ResourceLoader, VirtualConsole } = await import(
      'jsdom'
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
      'fetch',
      'Request',
      'Response',
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
      'jsdom'
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

import { importModule } from 'local-pkg'
import type { Environment, JSDOMOptions } from '../../types'
import { getWindowKeys } from './utils'

export default <Environment>({
  name: 'jsdom',
  async setup(global, { jsdom = {} }) {
    const {
      CookieJar,
      JSDOM,
      ResourceLoader,
      VirtualConsole,
    } = await importModule('jsdom') as typeof import('jsdom')
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
    const dom = new JSDOM(
      html,
      {
        pretendToBeVisual,
        resources: resources ?? (userAgent ? new ResourceLoader({ userAgent }) : undefined),
        runScripts,
        url,
        virtualConsole: console && global.console ? new VirtualConsole().sendTo(global.console) : undefined,
        cookieJar: cookieJar ? new CookieJar() : undefined,
        includeNodeLocations,
        contentType,
        userAgent,
        ...restOptions,
      },
    )

    const keys = getWindowKeys(global, dom.window)

    const overrideObject = new Map<string, any>()
    for (const key of keys) {
      Object.defineProperty(global, key, {
        get() {
          if (overrideObject.has(key))
            return overrideObject.get(key)
          return dom.window[key]
        },
        set(v) {
          overrideObject.set(key, v)
        },
        configurable: true,
      })
    }

    return {
      teardown(global) {
        keys.forEach(key => delete global[key])
      },
    }
  },
})

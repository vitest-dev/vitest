import { importModule } from 'local-pkg'
// todo@web-runner: omit JSDOMOptions, browser will fail
import type { Environment/* , JSDOMOptions */ } from '../../types'
import { populateGlobal } from './utils'

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
    } = jsdom as any
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

    const { keys, originals } = populateGlobal(global, dom.window, { bindFunctions: true })

    return {
      teardown(global) {
        keys.forEach(key => delete global[key])
        originals.forEach((v, k) => global[k] = v)
      },
    }
  },
})

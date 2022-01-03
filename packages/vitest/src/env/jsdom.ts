import { importModule } from 'local-pkg'
import type { Environment } from '../types'
import { KEYS } from './jsdom-keys'

export default <Environment>({
  name: 'jsdom',
  async setup(global, options) {
    const { JSDOM, ResourceLoader, VirtualConsole } = await importModule('jsdom') as typeof import('jsdom')
    const { html, userAgent, testURL, console, ...restOptions } = options
    const dom = new JSDOM(
      typeof html === 'string' ? html : '<!DOCTYPE html>',
      {
        pretendToBeVisual: true,
        resources: typeof userAgent === 'string'
          ? new ResourceLoader({ userAgent })
          : undefined,
        runScripts: 'dangerously',
        url: typeof testURL === 'string' ? testURL : 'http://localhost:3000',
        virtualConsole: new VirtualConsole().sendTo(
          console ?? global.console,
        ),
        ...restOptions,
      },
    )

    const keys = KEYS.concat(Object.getOwnPropertyNames(dom.window))
      .filter(k => !k.startsWith('_'))
      .filter(k => !(k in global))

    for (const key of keys) {
      Object.defineProperty(global, key, {
        get() { return dom.window[key] },
        configurable: true,
      })
    }

    global.window = global

    return {
      teardown(global) {
        keys.forEach(key => delete global[key])
      },
    }
  },
})

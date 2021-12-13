import { importModule } from 'local-pkg'
import type { Environment } from '../types'
import { KEYS } from './jsdom-keys'

export default <Environment>({
  name: 'jsdom',
  async setup(global) {
    const { JSDOM } = await importModule('jsdom') as typeof import('jsdom')
    const dom = new JSDOM('<!DOCTYPE html>',
      {
        pretendToBeVisual: true,
        runScripts: 'dangerously',
        // TODO: options
        url: 'http://localhost:3000',
      },
    )

    const keys = KEYS.concat(Object.getOwnPropertyNames(dom.window))
      .filter(k => !k.startsWith('_'))
      .filter(k => !(k in global))

    for (const key of keys)
      global[key] = dom.window[key]

    global.window = global

    return {
      teardown(global) {
        keys.forEach(key => delete global[key])
      },
    }
  },
})

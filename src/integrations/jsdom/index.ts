import { JSDOM } from 'jsdom'
import { KEYS } from './keys'

export function setupJSDOM(global: any) {
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

  return {
    dom,
    restore() {
      keys.forEach(key => delete global[key])
    },
  }
}

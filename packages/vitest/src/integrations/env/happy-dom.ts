import type { Environment } from '../../types'
import { populateGlobal } from './utils'

export default <Environment>({
  name: 'happy-dom',
  transformMode: 'web',
  async setupVM({ happyDOM = {} }) {
    const { Window } = await import('happy-dom')
    const win = new Window({
      ...happyDOM,
      console: (console && globalThis.console) ? globalThis.console : undefined,
      url: happyDOM.url || 'http://localhost:3000',
      settings: {
        ...happyDOM.settings,
        disableErrorCapturing: true,
      },
    }) as any

    // TODO: browser doesn't expose Buffer, but a lot of dependencies use it
    win.Buffer = Buffer

    // inject structuredClone if it exists
    if (typeof structuredClone !== 'undefined' && !win.structuredClone)
      win.structuredClone = structuredClone

    return {
      getVmContext() {
        return win
      },
      async teardown() {
        await win.happyDOM.cancelAsync()
      },
    }
  },
  async setup(global, { happyDOM = {} }) {
    // happy-dom v3 introduced a breaking change to Window, but
    // provides GlobalWindow as a way to use previous behaviour
    const { Window, GlobalWindow } = await import('happy-dom')
    const win = new (GlobalWindow || Window)({
      ...happyDOM,
      console: (console && global.console) ? global.console : undefined,
      url: happyDOM.url || 'http://localhost:3000',
      settings: {
        ...happyDOM.settings,
        disableErrorCapturing: true,
      },
    })

    const { keys, originals } = populateGlobal(global, win, {
      bindFunctions: true,
      // jsdom doesn't support Request and Response, but happy-dom does
      additionalKeys: ['Request', 'Response'],
    })

    return {
      teardown(global) {
        win.happyDOM.cancelAsync()
        keys.forEach(key => delete global[key])
        originals.forEach((v, k) => global[k] = v)
      },
    }
  },
})

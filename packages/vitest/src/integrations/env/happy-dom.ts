import type { Environment } from '../../types/environment'
import { populateGlobal } from './utils'

async function teardownWindow(win: {
  happyDOM: { abort?: () => Promise<void>; cancelAsync: () => void }
  close?: () => void
}) {
  if (win.close && win.happyDOM.abort) {
    await win.happyDOM.abort()
    win.close()
  }
  else {
    win.happyDOM.cancelAsync()
  }
}

export default <Environment>{
  name: 'happy-dom',
  transformMode: 'web',
  async setupVM({ happyDOM = {} }) {
    const { Window } = await import('happy-dom')
    let win = new Window({
      ...happyDOM,
      console: console && globalThis.console ? globalThis.console : undefined,
      url: happyDOM.url || 'http://localhost:3000',
      settings: {
        ...happyDOM.settings,
        disableErrorCapturing: true,
      },
    }) as any

    // TODO: browser doesn't expose Buffer, but a lot of dependencies use it
    win.Buffer = Buffer

    // inject structuredClone if it exists
    if (typeof structuredClone !== 'undefined' && !win.structuredClone) {
      win.structuredClone = structuredClone
    }

    return {
      getVmContext() {
        return win
      },
      async teardown() {
        await teardownWindow(win)
        win = undefined
      },
    }
  },
  async setup(global, { happyDOM = {} }) {
    // happy-dom v3 introduced a breaking change to Window, but
    // provides GlobalWindow as a way to use previous behaviour
    const { Window, GlobalWindow } = await import('happy-dom')
    const win = new (GlobalWindow || Window)({
      ...happyDOM,
      console: console && global.console ? global.console : undefined,
      url: happyDOM.url || 'http://localhost:3000',
      settings: {
        ...happyDOM.settings,
        disableErrorCapturing: true,
      },
    })

    const { keys, originals } = populateGlobal(global, win, {
      bindFunctions: true,
      // jsdom doesn't support Request and Response, but happy-dom does
      additionalKeys: ['Request', 'Response', 'MessagePort', 'fetch'],
    })

    return {
      async teardown(global) {
        await teardownWindow(win)
        keys.forEach(key => delete global[key])
        originals.forEach((v, k) => (global[k] = v))
      },
    }
  },
}

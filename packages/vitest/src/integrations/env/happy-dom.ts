import type { Environment } from '../../types/environment'
import { populateGlobal } from './utils'

const TEARDOWN_TIMEOUT_MS = 1000

function withTimeout(promise: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    timer.unref?.()
    promise.then(
      () => {
        clearTimeout(timer)
        resolve()
      },
      () => {
        clearTimeout(timer)
        resolve()
      },
    )
  })
}

async function teardownWindow(win: {
  happyDOM: {
    abort?: () => Promise<void>
    cancelAsync: () => void
    close?: () => Promise<void>
  }
  close?: () => void
}) {
  // Prefer `happyDOM.close()` so AsyncTaskManager is destroyed (marking it destroyed
  // discards timers scheduled by abort handlers instead of awaiting them), and bound
  // async teardown so a stalled cleanup task cannot hang worker shutdown.
  if (win.happyDOM.close) {
    await withTimeout(win.happyDOM.close(), TEARDOWN_TIMEOUT_MS)
  } else if (win.close && win.happyDOM.abort) {
    await withTimeout(win.happyDOM.abort(), TEARDOWN_TIMEOUT_MS)
    win.close()
  } else {
    win.happyDOM.cancelAsync()
  }
}

export default <Environment>{
  name: 'happy-dom',
  viteEnvironment: 'client',
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
      // jsdom doesn't support fetch API, but happy-dom does
      additionalKeys: [
        'Request',
        'Response',
        'MessagePort',
        'fetch',
        'Headers',
        'AbortController',
        'AbortSignal',
        'URL',
        'URLSearchParams',
        'FormData',
      ],
    })

    return {
      async teardown(global) {
        await teardownWindow(win)
        keys.forEach((key) => delete global[key])
        originals.forEach((d, k) => Object.defineProperty(global, k, d))
      },
    }
  },
}

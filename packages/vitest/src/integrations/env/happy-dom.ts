import { importModule } from 'local-pkg'
import type { Environment } from '../../types'
import { populateGlobal } from './utils'

export default ({
  name: 'happy-dom',
  transformMode: 'web',
  async setupVM() {
    const { Window } = await importModule('happy-dom') as typeof import('happy-dom')
    const win = new Window()

    win.global = win.window
    Object.defineProperty(win.document, 'defaultView', {
      value: win.window,
      configurable: true,
    })

    return {
      getVmContext() {
        return win
      },
      teardown() {
        win.happyDOM.cancelAsync()
      },
    }
  },
  async setup(global) {
    // happy-dom v3 introduced a breaking change to Window, but
    // provides GlobalWindow as a way to use previous behaviour
    const { Window, GlobalWindow } = await importModule('happy-dom') as typeof import('happy-dom')
    const win = new (GlobalWindow || Window)()

    const { keys, originals } = populateGlobal(global, win, { bindFunctions: true })

    return {
      teardown(global) {
        win.happyDOM.cancelAsync()
        keys.forEach(key => delete global[key])
        originals.forEach((v, k) => global[k] = v)
      },
    }
  },
}) satisfies Environment

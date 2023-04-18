import { Console } from 'node:console'
import { importModule } from 'local-pkg'
import type { Environment } from '../../types'

export default <Environment>({
  name: 'node',
  transformMode: 'ssr',
  async setupVm() {
    const vm = await importModule('node:vm')
    const global = {} // TODO: copy more globals
    const context = vm.createContext()
    return {
      getGlobal() {
        return global
      },
      getVmContext() {
        return context
      },
      teardown() {
        //
      },
    }
  },
  async setup(global) {
    global.console.Console = Console
    return {
      teardown(global) {
        delete global.console.Console
      },
    }
  },
})

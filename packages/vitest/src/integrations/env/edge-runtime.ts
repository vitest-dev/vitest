import type { Environment } from '../../types'
import { populateGlobal } from './utils'
import { KEYS } from './jsdom-keys'

export default <Environment>({
  name: 'edge-runtime',
  transformMode: 'ssr',
  async setupVM() {
    const { EdgeVM } = await import('@edge-runtime/vm')
    const vm = new EdgeVM({
      extend: (context) => {
        context.global = context
        context.Buffer = Buffer
        return context
      },
    })
    return {
      getVmContext() {
        return vm.context
      },
      teardown() {
        // nothing to teardown
      },
    }
  },
  async setup(global) {
    const { EdgeVM } = await import('@edge-runtime/vm')
    const vm = new EdgeVM({
      extend: (context) => {
        context.global = context
        context.Buffer = Buffer
        KEYS.forEach((key) => {
          if (key in global)
            context[key] = global[key]
        })
        return context
      },
    })
    const { keys, originals } = populateGlobal(global, vm.context, { bindFunctions: true })
    return {
      teardown(global) {
        keys.forEach(key => delete global[key])
        originals.forEach((v, k) => global[k] = v)
      },
    }
  },
})

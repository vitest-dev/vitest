import { importModule } from 'local-pkg'
import type { Environment } from '../../types'
import { populateGlobal } from './utils'

export default <Environment>({
  name: 'edge-runtime',
  transformMode: 'ssr',
  async setupVM() {
    const { EdgeVM } = await importModule('@edge-runtime/vm') as typeof import('@edge-runtime/vm')
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
        // TODO
      },
    }
  },
  async setup(global) {
    const { EdgeVM } = await importModule('@edge-runtime/vm') as typeof import('@edge-runtime/vm')
    const vm = new EdgeVM({
      extend: (context) => {
        context.global = context
        context.Buffer = Buffer
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

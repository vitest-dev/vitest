import v8 from 'node:v8'
import vm from 'node:vm'
import { builtinEnvironments } from 'vitest/runtime'

const previousContexts: WeakRef<object>[] = []

// node exposes no public gc hook, but the flag can be flipped just long
// enough to grab one from a throwaway context
v8.setFlagsFromString('--expose-gc')
const gc = vm.runInNewContext('gc')
v8.setFlagsFromString('--no-expose-gc')

async function assertReleased() {
  let alive = 0
  for (let attempt = 0; attempt < 10; attempt++) {
    gc()
    await new Promise(resolve => setTimeout(resolve, 10))
    alive = previousContexts.filter(ref => ref.deref()).length
    // a small number of worlds stays reachable through Node's ESM callback
    // registry (moduleRegistries): entries hold SourceTextModules through
    // their host-defined-options symbols until later registrations replace
    // them, which retains the youngest world or two, and occasionally the
    // first world of the worker. The bound only catches references that
    // accumulate with every file
    if (alive <= 4) {
      return
    }
  }
  throw new Error(
    `${alive} of ${previousContexts.length} vm contexts of finished test files were not released`,
  )
}

export default {
  name: 'leak-probe',
  viteEnvironment: 'client',
  async setupVM(options: Record<string, any>) {
    await assertReleased()
    const env = await builtinEnvironments.jsdom.setupVM!(options)
    previousContexts.push(new WeakRef(env.getVmContext()))
    return env
  },
}

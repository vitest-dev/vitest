import type { Environment } from 'vitest/runtime'
import vm from 'node:vm'
import { createDebug } from 'obug'

// test that external packages (obug) are loaded correctly
const log = createDebug('test:env')

export default <Environment>{
  name: 'custom',
  viteEnvironment: 'ssr',
  setupVM({ custom }) {
    const context = vm.createContext({
      testEnvironment: 'custom',
      option: custom.option,
      POOL_ID_DURING_ENV_SETUP: process.env.VITEST_POOL_ID,
      WORKER_ID_DURING_ENV_SETUP: process.env.VITEST_WORKER_ID,
      setTimeout,
      clearTimeout,
      AbortController,
      EventTarget,
      Event,
    })
    return {
      getVmContext() {
        return context
      },
      teardown() {
        delete context.testEnvironment
        delete context.option
      },
    }
  },
  setup(global, { custom }) {
    global.testEnvironment = 'custom'
    global.option = custom.option
    global.POOL_ID_DURING_ENV_SETUP = process.env.VITEST_POOL_ID
    global.WORKER_ID_DURING_ENV_SETUP = process.env.VITEST_WORKER_ID

    return {
      teardown() {
        delete global.testEnvironment
        delete global.option

        if (global.__exists) {
          log('should not log')
        }
      },
    }
  },
}

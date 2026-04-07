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
      setTimeout,
      clearTimeout,
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

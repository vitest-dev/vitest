import type { Environment } from 'vitest'
import vm from 'node:vm'
import debug from 'debug'

// test that external packages (debug) are loaded correctly
const log = debug('test:env')

export default <Environment>{
  name: 'custom',
  transformMode: 'ssr',
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

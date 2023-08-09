import vm from 'node:vm'

export default {
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
      },
    }
  },
}

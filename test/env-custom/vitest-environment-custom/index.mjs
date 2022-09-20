export default {
  name: 'custom',
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

export default new Proxy({}, {
  get() {
    throw new Error('Module "empty" has been externalized for browser compatibility and cannot be accessed in client code.')
  },
})

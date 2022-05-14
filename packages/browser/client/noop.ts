export default new Proxy({}, {
  get() {
    throw new Error('Module has been externalized for browser compatibility and cannot be accessed in client code.')
  },
})

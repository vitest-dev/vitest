exports.test = () => {
  return Object.hasOwn(exports, 'test')
}
exports.getPrototype = () => {
  return Object.getPrototypeOf(exports)
}

exports.test = () => {
  // eslint-disable-next-line no-prototype-builtins
  return exports.hasOwnProperty('test')
}
exports.getPrototype = () => {
  return Object.getPrototypeOf(exports)
}

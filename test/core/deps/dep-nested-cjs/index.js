if (typeof __vite_ssr_import_ !== 'undefined') {
  throw new TypeError('The module should be external')
}

const Klass = class Klass {
  static clickCancel() {
    // noop
  }
}
Klass.default = Klass
module.exports = Klass

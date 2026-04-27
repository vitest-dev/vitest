const methodSymbol = Symbol('x')

const moduleWithSymbol = {
  warn() {
    return this[methodSymbol]()
  },
  [methodSymbol]() {
    return 'hello'
  },
}

export { methodSymbol, moduleWithSymbol }

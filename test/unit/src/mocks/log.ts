const writeSym = Symbol('write')
const proto = {
  [writeSym]() {
    return 'hello'
  },
}
const logger = {
  warn() {
    ;(this as any)[writeSym]()
  },
}
Object.setPrototypeOf(logger, proto)
export default logger

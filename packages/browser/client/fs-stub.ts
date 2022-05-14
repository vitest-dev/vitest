import noop from './noop'

export default noop
export { noop as promises }
export function existsSync() {
  return false
}

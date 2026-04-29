import { getSubject } from './subject'

export function formatHello() {
  return `Hello, ${getSubject()}!`
}

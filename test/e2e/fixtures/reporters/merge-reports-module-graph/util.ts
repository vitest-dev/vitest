import { getSubject } from './sub/subject'

export function hello() {
  return `Hello, ${getSubject()}!`
}

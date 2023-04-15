import { a } from './a'
import { b } from './b'

export const index = 'index'

export function foo() {
  return index
}

export * from './a'
export * from './b'

// eslint-disable-next-line no-console
console.log(a(), b(), index)

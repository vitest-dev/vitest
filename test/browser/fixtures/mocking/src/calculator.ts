import { plus } from './actions'

export function calculator(operation: 'plus', a: number, b: number) {
  if (operation === 'plus')
    return plus(a, b)

  throw new Error('unknown operation')
}

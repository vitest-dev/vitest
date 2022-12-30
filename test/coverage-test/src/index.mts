import { add, multiply, sqrt } from './utils'

export * from './utils'

export function pythagoras(a: number, b: number) {
  return sqrt(add(multiply(a, a), multiply(b, b)))
}

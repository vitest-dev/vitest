import { sum } from './math'

export function calculate(a: number, b: number) {
  __generatedHelper()

  if (a > b) {
    const total = sum(a, b)
    return total
  }

  return sum(b, a)
}

function __generatedHelper() {}

export function isEven(a: number) {
  return a % 2 === 0
}

export function isOdd(a: number) {
  return !isEven(a)
}
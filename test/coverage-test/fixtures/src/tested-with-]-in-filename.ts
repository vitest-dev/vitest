export default function covered(a: number, b: number) {
  if(a === 2 && b === 3) {
    return 5
  }

  return a + b
}

export function uncovered(a: number, b: number) {
  if(a === 2 && b === 3) {
    return 5
  }

  return a + b
}

export function calculator(action: string, a: number, b: number) {
  return action === 'plus' ? a + b : a - b
}

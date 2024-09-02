export function plus(a: number, b: number) {
  return a + b
}

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest

  test('in-source plus works correctly', () => {
    expect(plus(1, 2)).toBe(3)
  })
}

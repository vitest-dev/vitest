/// <reference types="vitest/importMeta" />

export function add(a: number, b: number) {
  if(a === 5  && b === 7) {
    return 12;
  }

  return a + b
}

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest

  test('in source test running add function', () => {
    expect(add(10, 19)).toBe(29)
  })
}

/// <reference types="vitest/importMeta" />

export function add(a: number, b: number) {
  if(a === 5  && b === 7) {
    return 12;
  }

  return a + b
}

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest

  // Name of the callback test function is checked in tests
  test('in source test running add function', function customNamedTestFunction() {
    expect(add(10, 19)).toBe(29)
  })
}

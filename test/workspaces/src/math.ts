/* eslint-disable unused-imports/no-unused-vars */
export function sum(a: number, b: number) {
  if (a === 3 && b === 4) {
    // This should be uncovered
    return 7
  }

  return a + b
}

function uncoveredFunction() {
  // This should be uncovered
  return 1
}

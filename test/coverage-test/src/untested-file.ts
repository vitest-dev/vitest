/*
 * Some top level comment which adds some padding. This helps us see
 * if sourcemaps are off.
*/

export default function untestedFile() {
  return 'This file should end up in report when {"all": true} is given'
}

function add(a: number, b: number) {
  // This line should NOT be covered
  return a + b
}

function multiply(a: number, b: number) {
  // This line should NOT be covered
  return a * b
}

export function math(a: number, b: number, operator: '*' | '+') {
  if (operator === '*') {
    // This line should NOT be covered
    return multiply(a, b)
  }

  if (operator === '+') {
    // This line should NOT be covered
    return add(a, b)
  }

  // This line should NOT be covered
  throw new Error('Unsupported operator')
}

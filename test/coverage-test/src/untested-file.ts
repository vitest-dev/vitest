/*
 * Some top level comment which adds some padding. This helps us see
 * if sourcemaps are off.
*/

/* eslint-disable unused-imports/no-unused-vars -- intentional */

export default function untestedFile() {
  return 'This file should end up in report when {"all": true} is given'
}

function add(a: number, b: number) {
  // This line should NOT be covered
  return a + b
}

type TypescriptTypings = 1 | 2

function multiply(a: number, b: number) {
  // This line should NOT be covered
  return a * b
}

export function math(a: number, b: number, operator: '*' | '+') {
  interface MoreCompileTimeCode {
    should: {
      be: {
        excluded: true
      }
    }
  }

  if (operator === '*') {
    // This line should NOT be covered
    return multiply(a, b)
  }

  /* v8 ignore start */
  if (operator === '+') {
  // This line should be excluded
    return add(a, b)
  }
  /* v8 ignore stop */

  // This line should NOT be covered
  throw new Error('Unsupported operator')
}

/*
 * This file should have:
 * - 5 functions in total
 * - 3 covered functions
 * - 2 uncovered functions
 */

/* eslint-disable unused-imports/no-unused-vars */

// This function is covered
function first() {
  return 1
}

first()

// This function is covered
export function second() {
  fifth()
  return 2
}

// This function is NOT covered
export function third() {
  throw new Error('Do not call this function')
}

// This function is NOT covered
function fourth() {
  return 4
}

// This function is covered
function fifth() {
  return 5
}

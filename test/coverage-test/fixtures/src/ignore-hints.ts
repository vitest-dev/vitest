// padding
/* istanbul ignore next -- @preserve */
export function first() {
  return "First"
}

export function second() {
  return "Second"
}

/* istanbul ignore start */
export function third() {
  return "Third"
}

export function fourth() {
  return "fourh"
}
/* istanbul ignore stop */

// Covered line
second()

/* v8 ignore next -- @preserve, Uncovered line v8 */
second()

/* istanbul ignore next -- @preserve, Uncovered line istanbul */
second()

fourth()

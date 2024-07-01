/* v8 ignore next 4 */
/* istanbul ignore next -- @preserve */
export function first() {
  return "First"
}

export function second() {
  return "Second"
}

// Covered line
second()

/* v8 ignore next -- Uncovered line v8 */
second()

/* istanbul ignore next -- @preserve, Uncovered line istanbul */
second()

import { expect, it } from "vitest"

// https://github.com/vitest-dev/vitest/issues/5321
it('escape html in error diff', () => {
  expect('<style>* {border: 2px solid green};</style>').toBe("")
})

it('colored error message', () => {
  const blue = '\x1B[34m'
  const reset = '\x1B[0m'
  const message = `${blue}this-is-blue${reset}`
  const error = new Error(message)
  throw error
})

import { expect, it } from "vitest"

// https://github.com/vitest-dev/vitest/issues/5321
it('escape html in error diff', () => {
  expect('<style>* {border: 2px solid green};</style>').toBe("")
})

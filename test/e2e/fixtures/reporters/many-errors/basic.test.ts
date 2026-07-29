import { test } from "vitest"

test.for([...Array(20)].map((_, j) => j))('%i', (i) => {
  throw new Error(`error-${i}`)
})

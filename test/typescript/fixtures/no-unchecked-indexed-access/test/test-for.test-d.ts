import { test } from 'vitest'

test.for([[0, 0, 0]])('receives tuple values without undefined', ([r, g, b]) => {
  const toNumber = (value: number) => value

  toNumber(r)
  toNumber(g)
  toNumber(b)
})

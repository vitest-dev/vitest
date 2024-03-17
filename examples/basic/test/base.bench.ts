import { bench, describe } from 'vitest'

describe('sort', () => {
  let x: number[]
  let y: number[]

  bench('normal', () => {
    x.sort((a, b) => a - b)
  }, {
    setup: () => {
      x = Array.from({ length: 1000_000 }, (_, i) => i)
    },
  })

  bench('reverse', () => {
    y.sort((a, b) => a - b)
  }, {
    setup: () => {
      y = Array.from({ length: 1000_000 }, (_, i) => -i)
    },
  })
})

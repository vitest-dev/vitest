import { bench, describe } from 'vitest'

describe.skip('skipped', () => {
  bench('skipped', () => {
    throw new Error('should be skipped')
  })
})

bench.skip('skipped', () => {
  throw new Error('should be skipped')
})

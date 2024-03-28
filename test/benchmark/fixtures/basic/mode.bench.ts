import { bench, describe } from 'vitest'

describe.todo('unimplemented suite')

describe.skip('skipped', () => {
  bench('skipped', () => {
    throw new Error('should be skipped')
  })

  bench.todo('unimplemented test')
})

bench.skip('skipped', () => {
  throw new Error('should be skipped')
})

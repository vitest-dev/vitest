import { bench, describe } from 'vitest'

describe.todo('unimplemented suite')

describe.skip('skipped', () => {
  bench('skipped-1', () => {
    throw new Error('should be skipped')
  })

  bench.todo('unimplemented test')
})

bench.skip('skipped-2', () => {
  throw new Error('should be skipped')
})

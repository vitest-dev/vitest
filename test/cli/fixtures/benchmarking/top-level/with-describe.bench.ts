import { bench, describe } from 'vitest'

describe('group', () => {
  bench('sum', () => {
    1 + 1
  }, { iterations: 1, time: 0 })
})

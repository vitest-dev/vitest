import { bench } from 'vitest'

bench('sum', () => {
  1 + 1
}, { iterations: 1, time: 0 })

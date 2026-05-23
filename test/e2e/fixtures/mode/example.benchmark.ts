import { bench, describe } from 'vitest'

describe('example', () => {
  bench('simple', () => {
    let _ = 0
    _ += 1
  }, { iterations: 1, time: 1, warmupIterations: 0, warmupTime: 0 })
})

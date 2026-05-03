import { test } from 'vitest'

test('simple', async ({ bench }) => {
  await bench('simple', () => {
    let _ = 0
    _ += 1
  }).run({ iterations: 1, time: 1, warmupIterations: 0, warmupTime: 0 })
})

import { bench, describe } from 'vitest'
import { setTimeout } from 'node:timers/promises'

const options = { iterations: 1, warmupIterations: 1 }

bench('first', async () => {
  await setTimeout(500)
}, options)

bench('second', async () => {
  await setTimeout(500)
}, options)

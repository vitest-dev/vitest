import { bench, describe } from 'vitest'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('suite', () => {
  bench('sleep(10)', async () => {
    await sleep(10)
  }, { time: 20, iterations: 0 })

  bench('sleep(100)', async () => {
    await sleep(100);
  }, { time: 200, iterations: 0 })
})

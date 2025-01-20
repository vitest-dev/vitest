import { afterAll, test, vi } from 'vitest'

if (process.env.SET_CONFIG_SHUFFLE) {
  vi.setConfig({
    sequence: {
      shuffle: process.env.SET_CONFIG_SHUFFLE === 'true',
    },
  })
}

const numbers: number[] = []

test.for([1, 2, 3, 4, 5])('test %s', (v) => {
  numbers.push(v)
})

afterAll(() => {
  console.log(numbers)
})

import { bench, describe } from 'vitest'

describe('sort', () => {
  bench('normal', () => {
    const x = [1, 5, 4, 2, 3]
    x.sort((a, b) => {
      return a - b
    })
  }, { iterations: 5, time: 0 })

  bench('reverse', () => {
    const x = [1, 5, 4, 2, 3]
    x.reverse().sort((a, b) => {
      return a - b
    })
  }, { iterations: 5, time: 0 })

  // TODO: move to failed tests
  // should not be collected
  // it('test', () => {
  //   expect(1 + 1).toBe(3)
  // })
})

function timeout(time: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, time)
  })
}

describe('timeout', () => {
  bench('timeout100', async () => {
    await timeout(100)
  }, {
    setup() {

    },
    teardown() {

    },
    ...benchOptions
  })

  bench('timeout75', async () => {
    await timeout(75)
  }, benchOptions)

  bench('timeout50', async () => {
    await timeout(50)
  }, benchOptions)

  bench('timeout25', async () => {
    await timeout(25)
  }, benchOptions)

  // TODO: move to failed tests
  // test('reduce', () => {
  //   expect(1 - 1).toBe(2)
  // })
})

const benchOptions = {
  time: 0,
  iterations: 3,
  warmupIterations: 0,
  warmupTime: 0,
}

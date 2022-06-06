import { benchmark, describe, expect, test } from 'vitest'

describe('sort', () => {
  benchmark('normal', () => {
    const x = [1, 5, 4, 2, 3]
    x.sort((a, b) => {
      return a - b
    })
  })

  benchmark('reverse', () => {
    const x = [1, 5, 4, 2, 3]
    x.reverse().sort((a, b) => {
      return a - b
    })
  })

  test('add', () => {
    expect(1 + 1).toBe(2)
  })
})

function timeout(time: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, time)
  })
}

describe('timeout', () => {
  benchmark('timeout1000', async () => {
    await timeout(1000)
  })

  benchmark('timeout750', async () => {
    await timeout(750)
  })

  benchmark('timeout500', async () => {
    await timeout(500)
  })

  benchmark('timeout250', async () => {
    await timeout(250)
  })

  test('reduce', () => {
    expect(1 - 1).toBe(0)
  })
})

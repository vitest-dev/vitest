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
  benchmark('timeout100', async () => {
    await timeout(100)
  })

  benchmark('timeout75', async () => {
    await timeout(75)
  })

  benchmark('timeout50', async () => {
    await timeout(50)
  })

  benchmark('timeout25', async () => {
    await timeout(25)
  })

  test('reduce', () => {
    expect(1 - 1).toBe(0)
  })
})

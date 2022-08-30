import { bench, describe, expect, it, test } from 'vitest'

describe('sort', () => {
  bench('normal', () => {
    const x = [1, 5, 4, 2, 3]
    x.sort((a, b) => {
      return a - b
    })
  })

  bench('reverse', () => {
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
  bench('timeout100', async () => {
    await timeout(100)
  })

  bench('timeout75', async () => {
    await timeout(75)
  })

  bench('timeout50', async () => {
    await timeout(50)
  })

  bench('timeout25', async () => {
    await timeout(25)
  })

  test('reduce', () => {
    expect(1 - 1).toBe(0)
  })
})

describe('unit test', () => {
  // should not be collect
  it('test', () => {
    expect(1 + 1).toBe(3)
  })
})

import { describe, expect, it } from 'vitest'

let v = 0

function bumpSync() {
  v += 1
}

function bump() {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      v += 1
      resolve()
    }, 1)
  })
}

it('one', () => {
  bumpSync()
  expect(v).toBe(1)
})

it('two', async() => {
  expect(v).toBe(1)
  await bump()
  expect(v).toBe(2)
})

describe('suite', () => {
  it('three', () => {
    bumpSync()
    expect(v).toBe(3)
  })

  it('four', async() => {
    expect(v).toBe(3)
    await bump()
    expect(v).toBe(4)
  })

  it('four', () => {
    expect(v).toBe(4)
  })

  it('five', () => {
    bumpSync()
    expect(v).toBe(5)
  })
})

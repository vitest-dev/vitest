import { afterEach, describe, expect, test, vi } from 'vitest'

describe('testing date mock functionality', () => {
  afterEach(() => {
    vi.resetSystemDate()
  })

  test('seting time in the past', () => {
    const date = new Date(2000, 1, 1)

    vi.setSystemDate(date)

    expect(Date.now()).toBe(date.valueOf())
    expect(vi.getSystemDate()).toBe(date)

    vi.resetSystemDate()

    expect(Date.now()).not.toBe(date.valueOf())
    expect(vi.getSystemDate()).not.toBe(date)
  })

  test('setting time in different types', () => {
    const time = 1234567890

    vi.setSystemDate(time)

    expect(Date.now()).toBe(time)

    const timeStr = 'Fri Feb 20 2015 19:29:31 GMT+0530'
    const timeStrMs = 1424440771000

    vi.setSystemDate(timeStr)

    expect(Date.now()).toBe(timeStrMs)
  })
})

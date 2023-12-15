import { afterEach, describe, expect, test, vi } from 'vitest'

describe('testing date mock functionality', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test('setting time in the past', () => {
    const date = new Date(2000, 1, 1)

    vi.setSystemTime(date)

    expect(Date.now()).toBe(date.valueOf())
    expect(vi.getMockedSystemTime()).toBe(date)

    vi.useRealTimers()

    expect(Date.now()).not.toBe(date.valueOf())
    expect(vi.getMockedSystemTime()).not.toBe(date)
  })

  test('setting time in different types', () => {
    const time = 1234567890

    vi.setSystemTime(time)

    expect(Date.now()).toBe(time)

    const timeStr = 'Fri Feb 20 2015 19:29:31 GMT+0530'
    const timeStrMs = 1424440771000

    vi.setSystemTime(timeStr)

    expect(Date.now()).toBe(timeStrMs)
  })

  test('date prototype is correct', () => {
    vi.setSystemTime(new Date(2000, 1, 1))

    expect(new Date()).toBeInstanceOf(Date)
  })
})

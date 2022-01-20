import { afterEach, describe, expect, test, vi } from 'vitest'

describe('testing date mock functionality', () => {
  afterEach(() => {
    vi.restoreCurrentDate()
  })

  test('seting time in the past', () => {
    const date = new Date(2000, 1, 1)

    vi.mockCurrentDate(date)

    expect(Date.now()).toBe(date.valueOf())
    expect(vi.getMockedDate()).toBe(date)

    vi.restoreCurrentDate()

    expect(Date.now()).not.toBe(date.valueOf())
    expect(vi.getMockedDate()).not.toBe(date)
  })

  test('setting time in different types', () => {
    const time = 1234567890

    vi.mockCurrentDate(time)

    expect(Date.now()).toBe(time)

    const timeStr = 'Fri Feb 20 2015 19:29:31 GMT+0530'
    const timeStrMs = 1424440771000

    vi.mockCurrentDate(timeStr)

    expect(Date.now()).toBe(timeStrMs)
  })
})

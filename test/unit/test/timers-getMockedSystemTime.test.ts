import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
})

it('with fake timers', () => {
  expect(vi.getMockedSystemTime()).toBe(null)

  vi.useFakeTimers()
  expect(vi.getMockedSystemTime()).toEqual(new Date())

  vi.setSystemTime(0)
  expect(vi.getMockedSystemTime()).toEqual(new Date())
  expect(vi.getMockedSystemTime()).toEqual(new Date(0))

  vi.advanceTimersByTime(1234)
  expect(vi.getMockedSystemTime()).toEqual(new Date())
  expect(vi.getMockedSystemTime()).toEqual(new Date(1234))

  vi.useRealTimers()
  expect(vi.getMockedSystemTime()).toBe(null)
  expect(new Date()).not.toEqual(new Date(1234))

  vi.useFakeTimers({ now: 12345 })
  expect(vi.getMockedSystemTime()).toEqual(new Date())
  expect(vi.getMockedSystemTime()).toEqual(new Date(12345))
})

it('without fake timers', () => {
  expect(vi.getMockedSystemTime()).toBe(null)

  vi.setSystemTime(0)
  expect(vi.getMockedSystemTime()).toEqual(new Date())
  expect(vi.getMockedSystemTime()).toEqual(new Date(0))

  vi.setSystemTime(1234)
  expect(vi.getMockedSystemTime()).toEqual(new Date())
  expect(vi.getMockedSystemTime()).toEqual(new Date(1234))

  vi.useRealTimers()
  expect(vi.getMockedSystemTime()).toBe(null)
  expect(new Date()).not.toEqual(new Date(1234))

  vi.setSystemTime(12345)
  expect(vi.getMockedSystemTime()).toEqual(new Date())
  expect(vi.getMockedSystemTime()).toEqual(new Date(12345))
})

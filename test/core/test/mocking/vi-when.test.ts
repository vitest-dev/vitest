import { afterEach, expect, test, vi } from 'vitest'
import * as a from '../../src/mockedA'

vi.mock('../../src/mockedA')

interface FnData {
  args: [a: string, b: number]
  value: number
  entries: [FnData['args'], FnData['value']][]
}

type Fn = (...args: FnData['args']) => FnData['value']

afterEach(() => {
  vi.restoreAllMocks()
})

test('vi.when() matches arguments', () => {
  const spy = vi.fn<Fn>()

  const entries: FnData['entries'] = [
    [['a', 0], 97],
    [['b', 1], 99],
  ]

  vi.when(spy)
    .calledWith(...entries[0][0])
    .thenReturn(entries[0][1])
    .calledWith(...entries[1][0])
    .thenReturn(entries[1][1])

  expect(spy(...entries[0][0])).toBe(entries[0][1])

  expect(spy).toHaveBeenLastCalledWith(...entries[0][0])
  expect(spy).toHaveLastReturnedWith(entries[0][1])

  expect(spy(...entries[1][0])).toBe(entries[1][1])

  expect(spy).toHaveBeenLastCalledWith(...entries[1][0])
  expect(spy).toHaveLastReturnedWith(entries[1][1])

  expect(spy).toHaveBeenCalledTimes(2)
})

test('vi.when() falls back to default implementation when not matching', () => {
  const spy = vi.fn<Fn>((a, b) => b * a.charCodeAt(0))

  const args: FnData['args'] = ['a', 0]
  const value: FnData['value'] = 97

  vi.when(spy)
    .calledWith(...args)
    .thenReturn(value)

  expect(spy('b', 1)).toBe(98)

  expect(spy).not.toHaveBeenLastCalledWith(...args)
  expect(spy).not.toHaveLastReturnedWith(value)

  expect(spy).toHaveBeenCalledOnce()
})

test('vi.when() supports once matchers', () => {
  const spy = vi.fn<Fn>((a, b) => b * a.charCodeAt(0))

  const args: FnData['args'] = ['a', 0]
  const values: FnData['value'][] = [
    97,
    98,
  ]

  vi.when(spy)
    .calledWith(...args)
    .thenReturn(values[0])
    .calledWith(...args)
    .thenReturnOnce(values[1])

  expect(spy(...args)).toBe(values[1])

  expect(spy).toHaveBeenLastCalledWith(...args)
  expect(spy).toHaveLastReturnedWith(values[1])

  expect(spy(...args)).toBe(values[0])

  expect(spy).toHaveBeenLastCalledWith(...args)
  expect(spy).toHaveLastReturnedWith(values[0])

  expect(spy).toHaveBeenCalledTimes(2)
})

test('vi.when() resolves matchers right to left', () => {
  const spy = vi.fn<Fn>()

  const args: FnData['args'] = ['a', 0]
  const values: FnData['value'][] = [
    97,
    98,
    99,
  ]

  vi.when(spy)
    .calledWith(...args)
    .thenReturn(values[0])
    .calledWith(...args)
    .thenReturnOnce(values[1])
    .calledWith(...args)
    .thenReturn(values[2])

  expect(spy(...args)).toBe(values[2])

  expect(spy).toHaveBeenLastCalledWith(...args)
  expect(spy).toHaveLastReturnedWith(values[2])

  expect(spy(...args)).toBe(values[2])

  expect(spy).toHaveBeenLastCalledWith(...args)
  expect(spy).toHaveLastReturnedWith(values[2])

  expect(spy(...args)).toBe(values[2])

  expect(spy).toHaveBeenLastCalledWith(...args)
  expect(spy).toHaveLastReturnedWith(values[2])

  expect(spy).toHaveBeenCalledTimes(3)
})

test('vi.when() throws when using toThrow', () => {
  const spy = vi.fn<Fn>()

  const args: FnData['args'] = ['a', 0]
  const error = new TypeError('Expected second argument > 0')

  vi.when(spy)
    .calledWith(...args)
    .thenThrow(error)

  expect(() => spy(...args)).toThrow(error)

  expect(spy).toHaveBeenLastCalledWith(...args)

  expect(spy).toHaveBeenCalledOnce()
})

test('vi.when() resolves a promise when using toResolve', async () => {
  const spy = vi.fn<Fn>()

  const args: FnData['args'] = ['a', 0]
  const value: FnData['value'] = 97

  vi.when(spy)
    .calledWith(...args)
    .thenResolve(value)

  await expect(spy(...args)).resolves.toBe(value)

  expect(spy).toHaveBeenLastCalledWith(...args)
  expect(spy).toHaveLastResolvedWith(value)

  expect(spy).toHaveBeenCalledOnce()
})

test('vi.when() rejects a promise when using toReject', async () => {
  const spy = vi.fn<Fn>()

  const args: FnData['args'] = ['a', 0]
  const error = new TypeError('Expected second argument > 0')

  vi.when(spy)
    .calledWith(...args)
    .thenReject(error)

  await expect(spy(...args)).rejects.toThrow(error)

  expect(spy).toHaveBeenLastCalledWith(...args)

  expect(spy).toHaveBeenCalledOnce()
})

test('vi.when() works with asymmetric matchers', () => {
  const spy = vi.fn<Fn>(() => Number.NaN)

  const args: FnData['args'] = [expect.stringContaining('--'), expect.any(Number)]
  const value: FnData['value'] = 0

  vi.when(spy)
    .calledWith(...args)
    .thenReturn(value)

  expect(spy('a--z', Number.NEGATIVE_INFINITY)).toBe(value)
  expect(spy('z--a', Number.POSITIVE_INFINITY)).toBe(value)

  expect(spy('a__z', Number.NEGATIVE_INFINITY)).toBe(Number.NaN)
  expect(spy('z__a', Number.NEGATIVE_INFINITY)).toBe(Number.NaN)
})

test('vi.when() groups asymmetric matchers correctly', () => {
  const spy = vi.fn<Fn>(() => Number.NaN)

  const value: FnData['value'] = 0
  const once: FnData['value'] = 1

  vi.when(spy)
    .calledWith(expect.stringContaining('--'), expect.any(Number))
    .thenReturn(value)
    .calledWith(expect.stringContaining('--'), expect.any(Number))
    .thenReturnOnce(once)

  expect(spy('a--z', 0)).toBe(once)
  expect(spy('a--z', 0)).toBe(value)
})

test('vi.when() works with vi.mock()', () => {
  expect(a.mockedA()).toBe(undefined)

  vi.when(a.mockedA).calledWith().thenReturnOnce('B')

  expect(a.mockedA()).toBe('B')

  expect(a.mockedA()).toBe(undefined)
})

test('vi.when() works with vi.spyOn()', () => {
  const message = 'ResizeObserver loop completed with undelivered notifications.'
  const value = 'not undefined'

  vi.when(vi.spyOn(console, 'error'))
    .calledWith(
      expect.objectContaining({ message }),
    )
    .thenReturn(value as never)

  expect(console.error({ message })).toBe(value)
  expect(console.error({ message: message.slice(0, 14) })).toBe(undefined)
})

test('vi.when() works without having to re-declare arguments in a chain', () => {
  const spy = vi.fn<Fn>()

  const args: FnData['args'] = ['a', 0]
  const values: FnData['value'][] = [
    97,
    98,
  ]

  vi.when(spy)
    .calledWith(...args)
    .thenReturn(values[0])
    .thenReturnOnce(values[1])

  expect(spy(...args)).toBe(values[1])

  expect(spy).toHaveBeenLastCalledWith(...args)
  expect(spy).toHaveLastReturnedWith(values[1])

  expect(spy(...args)).toBe(values[0])

  expect(spy).toHaveBeenLastCalledWith(...args)
  expect(spy).toHaveLastReturnedWith(values[0])

  expect(spy).toHaveBeenCalledTimes(2)
})

test.runIf(Symbol.dispose)('vi.when() disposes of its mock', () => {
  const spy = vi.fn<Fn>((a, b) => b * a.charCodeAt(0))

  const args: FnData['args'] = ['a', 0]
  const value: FnData['value'] = 97

  {
    using _ = vi.when(spy)
      .calledWith(...args)
      .thenReturn(value)

    expect(spy(...args)).toBe(value)
  }

  expect(spy(...args)).toBe(0)
})

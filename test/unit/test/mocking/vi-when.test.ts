import { afterEach, describe, expect, test, vi } from 'vitest'
import * as a from '../../src/mockedA'

vi.mock('../../src/mockedA')

interface FnData {
  args: [a: string, b: number]
  value: number
  entries: { args: FnData['args']; value: FnData['value'] }[]
}

type Fn = (...args: FnData['args']) => FnData['value']

describe('vi.when()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('basic usage', () => {
    test('returns provided value when arguments match', () => {
      const spy = vi.fn<Fn>()

      const entries: FnData['entries'] = [
        { args: ['a', 0], value: 97 },
        { args: ['b', 1], value: 99 },
      ]

      const w = vi.when(spy)
        .calledWith(...entries[0].args)
        .thenReturn(entries[0].value)
        .calledWith(...entries[1].args)
        .thenReturn(entries[1].value)

      expect(w.isExhausted()).toBe(false)

      expect(spy(...entries[0].args)).toBe(entries[0].value)

      expect(spy).toHaveBeenLastCalledWith(...entries[0].args)
      expect(spy).toHaveLastReturnedWith(entries[0].value)

      expect(w.isExhausted()).toBe(false)

      expect(spy(...entries[1].args)).toBe(entries[1].value)

      expect(spy).toHaveBeenLastCalledWith(...entries[1].args)
      expect(spy).toHaveLastReturnedWith(entries[1].value)

      expect(spy).toHaveBeenCalledTimes(2)

      expect(w.isExhausted()).toBe(true)
    })

    test('falls through to original implementation when arguments don\'t match', () => {
      const spy = vi.fn<Fn>((a, b) => b * a.charCodeAt(0))

      const args: FnData['args'] = ['a', 0]
      const value: FnData['value'] = 97

      const w = vi.when(spy)
        .calledWith(...args)
        .thenReturn(value)

      expect(w.isExhausted()).toBe(false)

      expect(spy('b', 1)).toBe(98)

      expect(spy).not.toHaveBeenLastCalledWith(...args)
      expect(spy).not.toHaveLastReturnedWith(value)

      expect(spy).toHaveBeenCalledOnce()

      expect(w.isExhausted()).toBe(false)
    })

    test('returns provided value when arguments match using asymmetric matchers', () => {
      const spy = vi.fn<Fn>(() => Number.NaN)

      const args: FnData['args'] = [expect.stringContaining('--'), expect.any(Number)]
      const value: FnData['value'] = 0

      const w = vi.when(spy)
        .calledWith(...args)
        .thenReturn(value)

      expect(w.isExhausted()).toBe(false)

      expect(spy('a--z', Number.NEGATIVE_INFINITY)).toBe(value)
      expect(spy('z--a', Number.POSITIVE_INFINITY)).toBe(value)

      expect(w.isExhausted()).toBe(true)

      expect(spy('a__z', Number.NEGATIVE_INFINITY)).toBe(Number.NaN)
      expect(spy('z__a', Number.NEGATIVE_INFINITY)).toBe(Number.NaN)
    })

    test('throws when using `toThrow`', () => {
      const spy = vi.fn<Fn>()

      const args: FnData['args'] = ['a', 0]
      const error = new TypeError('Expected second argument > 0')

      const w = vi.when(spy)
        .calledWith(...args)
        .thenThrow(error)

      expect(w.isExhausted()).toBe(false)

      expect(() => spy(...args)).toThrow(error)

      expect(spy).toHaveBeenLastCalledWith(...args)

      expect(spy).toHaveBeenCalledOnce()

      expect(w.isExhausted()).toBe(true)
    })

    test('resolves a promise when using `toResolve`', async () => {
      const spy = vi.fn<Fn>()

      const args: FnData['args'] = ['a', 0]
      const value: FnData['value'] = 97

      const w = vi.when(spy)
        .calledWith(...args)
        .thenResolve(value)

      expect(w.isExhausted()).toBe(false)

      await expect(spy(...args)).resolves.toBe(value)

      expect(spy).toHaveBeenLastCalledWith(...args)
      expect(spy).toHaveLastResolvedWith(value)

      expect(spy).toHaveBeenCalledOnce()

      expect(w.isExhausted()).toBe(true)
    })

    test('rejects a promise when using `toReject`', async () => {
      const spy = vi.fn<Fn>()

      const args: FnData['args'] = ['a', 0]
      const error = new TypeError('Expected second argument > 0')

      const w = vi.when(spy)
        .calledWith(...args)
        .thenReject(error)

      expect(w.isExhausted()).toBe(false)

      await expect(spy(...args)).rejects.toThrow(error)

      expect(spy).toHaveBeenLastCalledWith(...args)

      expect(spy).toHaveBeenCalledOnce()

      expect(w.isExhausted()).toBe(true)
    })

    test.runIf(Symbol.dispose)('disposes of its mock', () => {
      const firstSpy = vi.fn<Fn>((a, b) => b * a.charCodeAt(0))
      const secondSpy = vi.fn<Fn>()

      const args: FnData['args'] = ['a', 0]
      const value: FnData['value'] = 97

      {
        using w = vi.when(firstSpy)
          .calledWith(...args)
          .thenReturn(value)

        expect(w.isExhausted()).toBe(false)

        expect(firstSpy(...args)).toBe(value)
        expect(w.isExhausted()).toBe(true)
      }

      expect(firstSpy(...args)).toBe(0)

      {
        using w = vi.when(secondSpy)
          .calledWith(...args)
          .thenReturn(value)

        expect(w.isExhausted()).toBe(false)

        expect(secondSpy(...args)).toBe(value)
        expect(w.isExhausted()).toBe(true)
      }

      expect(secondSpy(...args)).toBe(undefined)
    })
  })

  describe('non-matching behavior', () => {
    test('falls through to original implementation when `onUnmatched` is set to "passthrough"', () => {
      const spy = vi.fn<Fn>((a, b) => b * a.charCodeAt(0))

      vi.when(spy, { onUnmatched: 'passthrough' })
        .calledWith('a', 0)
        .thenReturn(97)

      expect(spy('b', 1)).toBe(98)
    })

    test('throws when `onUnmatched` is set to "throw"', () => {
      const spy = vi.fn<Fn>()

      const args: FnData['args'] = ['a', 0]
      const value: FnData['value'] = 97

      vi.when(spy, { onUnmatched: 'throw' })
        .calledWith(...args)
        .thenReturn(value)

      expect(spy(...args)).toBe(value)
      expect(() => spy('b', 1)).toThrow('vi.when: no behavior defined')
    })

    test('calls the provided function when `onUnmatched` is a function', () => {
      const spy = vi.fn<Fn>()
      const fallback = vi.fn<Fn>(() => 0)

      const args: FnData['args'] = ['a', 0]
      const value: FnData['value'] = 97

      vi.when(spy, { onUnmatched: fallback })
        .calledWith(...args)
        .thenReturn(value)

      expect(spy(...args)).toBe(value)
      expect(spy('b', 1)).toBe(0)
      expect(fallback).toHaveBeenCalledWith('b', 1)
    })
  })

  describe('exhausting behaviors', () => {
    test('returns the provided value as described by the `times` option', async () => {
      const spy = vi.fn<Fn>()

      const args: FnData['args'] = ['a', 0]
      const values: FnData['value'][] = [
        97,
        98,
        99,
      ]
      const throwError = new TypeError('[throw] Expected second argument > 0')
      const rejectError = new TypeError('[reject] Expected second argument > 0')

      const times = 2

      const w = vi.when(spy)
        .calledWith(...args)
        .thenReturn(values[0])
        .calledWith(...args)
        .thenReturn(values[1], { times })
        .calledWith(...args)
        .thenThrow(throwError, { times })
        .calledWith(...args)
        .thenResolve(values[2], { times })
        .calledWith(...args)
        .thenReject(rejectError, { times })

      expect(w.isExhausted()).toBe(false)

      for (let i = 0; i < times; i += 1) {
        await expect(spy(...args)).rejects.toThrow(rejectError)
        expect(w.isExhausted()).toBe(false)
      }

      expect(spy).toHaveBeenCalledTimes(times)

      for (let i = 0; i < times; i += 1) {
        await expect(spy(...args)).resolves.toBe(values[2])
        expect(w.isExhausted()).toBe(false)
      }

      expect(spy).toHaveBeenCalledTimes(times * 2)

      for (let i = 0; i < times; i += 1) {
        expect(() => spy(...args)).toThrow(throwError)
        expect(w.isExhausted()).toBe(false)
      }

      expect(spy).toHaveBeenCalledTimes(times * 3)

      for (let i = 0; i < times; i += 1) {
        expect(spy(...args)).toBe(values[1])
        expect(w.isExhausted()).toBe(false)
      }

      expect(spy).toHaveBeenCalledTimes(times * 4)

      expect(spy(...args)).toBe(values[0])
      expect(w.isExhausted()).toBe(true)

      expect(spy).toHaveBeenCalledTimes(times * 4 + 1)
    })

    test('multiple behaviors can be chained on a single `calledWith` call', () => {
      const spy = vi.fn<Fn>()

      const args: FnData['args'] = ['a', 0]
      const values: FnData['value'][] = [
        97,
        98,
      ]

      const w = vi.when(spy)
        .calledWith(...args)
        .thenReturn(values[0])
        .thenReturn(values[1], { times: 2 })

      expect(w.isExhausted()).toBe(false)

      expect(spy(...args)).toBe(values[1])
      expect(w.isExhausted()).toBe(false)

      expect(spy(...args)).toBe(values[1])
      expect(w.isExhausted()).toBe(false)

      expect(spy(...args)).toBe(values[0])
      expect(w.isExhausted()).toBe(true)

      expect(spy).toHaveBeenCalledTimes(3)
    })

    test('groups behaviors based on asymmetric matchers correctly', () => {
      const spy = vi.fn<Fn>(() => Number.NaN)

      const value: FnData['value'] = 0
      const once: FnData['value'] = 1

      const w = vi.when(spy)
        .calledWith(expect.stringContaining('--'), expect.any(Number))
        .thenReturn(value)
        .calledWith(expect.stringContaining('--'), expect.any(Number))
        .thenReturnOnce(once)

      expect(w.isExhausted()).toBe(false)

      expect(spy('a--z', 0)).toBe(once)
      expect(w.isExhausted()).toBe(false)

      expect(spy('a--z', 1)).toBe(value)
      expect(w.isExhausted()).toBe(true)
    })

    test('`*Once` behaviors are sugar syntax for `times: 1`', async () => {
      const spy = vi.fn<Fn>()

      const args: FnData['args'] = ['a', 0]
      const values: FnData['value'][] = [
        97,
        98,
        99,
      ]
      const throwError = new TypeError('[throw] Expected second argument > 0')
      const rejectError = new TypeError('[reject] Expected second argument > 0')

      const w = vi.when(spy)
        .calledWith(...args)
        .thenReturn(values[0])
        .thenReturnOnce(values[1])
        .thenThrowOnce(throwError)
        .thenResolveOnce(values[2])
        .thenRejectOnce(rejectError)

      expect(w.isExhausted()).toBe(false)

      await expect(spy(...args)).rejects.toThrow(rejectError)
      expect(w.isExhausted()).toBe(false)

      await expect(spy(...args)).resolves.toBe(values[2])
      expect(w.isExhausted()).toBe(false)

      expect(() => spy(...args)).toThrow(throwError)
      expect(w.isExhausted()).toBe(false)

      expect(spy(...args)).toBe(values[1])
      expect(w.isExhausted()).toBe(false)

      expect(spy(...args)).toBe(values[0])
      expect(w.isExhausted()).toBe(true)

      expect(spy).toHaveBeenCalledTimes(5)
    })

    test('resolves behaviors in a LIFO-style manner', () => {
      const spy = vi.fn<Fn>()

      const args: FnData['args'] = ['a', 0]
      const values: FnData['value'][] = [
        97,
        98,
        99,
      ]

      const w = vi.when(spy)
        .calledWith(...args)
        .thenReturn(values[0])
        .thenReturnOnce(values[1])
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

      expect(w.isExhausted()).toBe(false) // still `false` as the first two behaviors cannot be reached
    })
  })

  describe('module mocks and spies', () => {
    test('works with vi.mock()', () => {
      expect(a.mockedA()).toBe(undefined)

      const w = vi.when(a.mockedA).calledWith().thenReturnOnce('B')

      expect(w.isExhausted()).toBe(false)

      expect(a.mockedA()).toBe('B')
      expect(w.isExhausted()).toBe(true)

      expect(a.mockedA()).toBe(undefined)
    })

    test('works with vi.spyOn()', () => {
      const message = 'ResizeObserver loop completed with undelivered notifications.'
      const value = 'not undefined'

      const w = vi.when(vi.spyOn(console, 'error'))
        .calledWith(expect.objectContaining({ message }))
        .thenReturn(value as never)

      expect(w.isExhausted()).toBe(false)

      expect(console.error({ message })).toBe(value)
      expect(w.isExhausted()).toBe(true)

      expect(console.error({ message: message.slice(0, 14) })).toBe(undefined)
    })
  })

  describe('edge cases', () => {
    test('`isExhausted` returns false when no behaviors are registered', () => {
      const spy = vi.fn<Fn>()

      const w = vi.when(spy)

      expect(w.isExhausted()).toBe(false)
    })
  })
})

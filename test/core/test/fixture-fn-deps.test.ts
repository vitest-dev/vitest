import { describe, expect, expectTypeOf, test, vi } from 'vitest'

interface Fixtures {
  a: number
  b: number
  c: number
  d: number
}

const fnB = vi.fn()
const myTest = test.extend<Pick<Fixtures, 'a' | 'b'>>({
  a: 1,
  b: async (use, { a }) => {
    fnB()
    await use (a * 2) // 2
    fnB.mockClear()
  },
})

const fnA = vi.fn()
const fnB2 = vi.fn()
const fnC = vi.fn()
const fnD = vi.fn()
const myTest2 = myTest.extend<Pick<Fixtures, 'c' | 'd'> & { a: string; b: string }>({
  // override origin a
  a: async (use, { a: originA }) => {
    expectTypeOf(originA).toEqualTypeOf<number>()
    fnA()
    await use(String(originA)) // '1'
    fnA.mockClear()
  },
  b: async (use, { a }) => {
    expectTypeOf(a).toEqualTypeOf<string>()
    fnB2()
    await use(String(Number(a) * 2)) // '2'
    fnB2.mockClear()
  },
  c: async (use, { a, b }) => {
    expectTypeOf(b).toEqualTypeOf<string>()
    fnC()
    await use(Number(a) + Number(b)) // 3
    fnC.mockClear()
  },
  d: async (use, { a, b, c }) => {
    fnD()
    await use(Number(a) + Number(b) + c) // 6
    fnD.mockClear()
  },
})

describe('test.extend()', () => {
  describe('fixture override', () => {
    myTest('origin a and b', ({ a, b }) => {
      expect(a).toBe(1)
      expect(b).toBe(2)

      expectTypeOf(a).toEqualTypeOf<number>()
      expectTypeOf(b).toEqualTypeOf<number>()

      expect(fnB).toBeCalledTimes(1)

      expect(fnB2).not.toBeCalled()
      expect(fnA).not.toBeCalled()
      expect(fnC).not.toBeCalled()
      expect(fnD).not.toBeCalled()
    })

    myTest2('overriding a and b', ({ a, b }) => {
      expect(a).toBe('1')
      expect(b).toBe('2')

      expectTypeOf(a).toEqualTypeOf<string>()
      expectTypeOf(b).toEqualTypeOf<string>()

      expect(fnA).toBeCalledTimes(1)
      expect(fnB).toBeCalledTimes(1)
      expect(fnB2).toBeCalledTimes(1)

      expect(fnC).not.toBeCalled()
      expect(fnD).not.toBeCalled()
    })
  })

  describe('fixture dependency', () => {
    myTest2('b => a', ({ b }) => {
      expect(b).toBe('2')

      expect(fnA).toBeCalledTimes(1)
      expect(fnB).toBeCalledTimes(1)
      expect(fnB2).toBeCalledTimes(1)

      expect(fnC).not.toBeCalled()
      expect(fnD).not.toBeCalled()
    })

    myTest2('c => [a, b]', ({ c }) => {
      expect(c).toBe(3)

      expect(fnA).toBeCalledTimes(1)
      expect(fnB).toBeCalledTimes(1)
      expect(fnB2).toBeCalledTimes(1)
      expect(fnC).toBeCalledTimes(1)

      expect(fnD).not.toBeCalled()
    })

    myTest2('d => c', ({ d }) => {
      expect(d).toBe(6)

      expect(fnA).toBeCalledTimes(1)
      expect(fnB).toBeCalledTimes(1)
      expect(fnB2).toBeCalledTimes(1)
      expect(fnC).toBeCalledTimes(1)
      expect(fnD).toBeCalledTimes(1)
    })

    myTest2('should only call once for each fixture fn', ({ a, b, c, d }) => {
      expect(a).toBe('1')
      expect(b).toBe('2')
      expect(c).toBe(3)
      expect(d).toBe(6)

      expect(fnA).toBeCalledTimes(1)
      expect(fnB).toBeCalledTimes(1)
      expect(fnB2).toBeCalledTimes(1)
      expect(fnC).toBeCalledTimes(1)
      expect(fnD).toBeCalledTimes(1)
    })
  })
})

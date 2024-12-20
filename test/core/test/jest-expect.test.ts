/* eslint-disable no-sparse-arrays */
import nodeAssert, { AssertionError } from 'node:assert'
import { stripVTControlCharacters } from 'node:util'
import { generateToBeMessage } from '@vitest/expect'
import { processError } from '@vitest/utils/error'
import { assert, beforeAll, describe, expect, it, vi } from 'vitest'

class TestError extends Error {}

// For expect.extend
interface CustomMatchers<R = unknown> {
  toBeDividedBy: (divisor: number) => R
  toBeTestedAsync: () => Promise<R>
  toBeTestedSync: () => R
  toBeTestedPromise: () => R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

declare global {
  // eslint-disable-next-line ts/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeJestCompatible: () => R
    }
  }
}

describe('jest-expect', () => {
  it('basic', () => {
    expect(1).toBe(1)
    expect(null).toBeNull()
    expect(1).not.toBeNull()
    expect(null).toBeDefined()
    expect(undefined).not.toBeDefined()
    expect(undefined).toBeUndefined()
    expect(null).not.toBeUndefined()
    expect([]).toBeTruthy()
    expect(0).toBeFalsy()
    expect('Hello').toMatch(/llo/)
    expect('Hello').toMatch('llo')
    expect('Hello').toContain('llo')
    expect(['Hello']).toContain('Hello')
    expect([{ text: 'Hello' }]).toContainEqual({ text: 'Hello' })
    expect([{ text: 'Bye' }]).not.toContainEqual({ text: 'Hello' })
    expect(1).toBeGreaterThan(0)

    expect(new Date(0)).toEqual(new Date(0))
    expect(new Date('inValId')).toEqual(new Date('inValId'))

    expect(new Error('message')).toEqual(new Error('message'))
    expect(new Error('message')).not.toEqual(new Error('different message'))

    expect(new URL('https://example.org')).toEqual(new URL('https://example.org'))
    expect(new URL('https://example.org')).not.toEqual(new URL('https://different-example.org'))
    expect(new URL('https://example.org?query=value')).toEqual(new URL('https://example.org?query=value'))
    expect(new URL('https://example.org?query=one')).not.toEqual(new URL('https://example.org?query=two'))
    expect(new URL('https://subdomain.example.org/path?query=value#fragment-identifier')).toEqual(new URL('https://subdomain.example.org/path?query=value#fragment-identifier'))
    expect(new URL('https://subdomain.example.org/path?query=value#fragment-identifier')).not.toEqual(new URL('https://subdomain.example.org/path?query=value#different-fragment-identifier'))
    expect(new URL('https://example.org/path')).toEqual(new URL('/path', 'https://example.org'))
    expect(new URL('https://example.org/path')).not.toEqual(new URL('/path', 'https://example.com'))

    expect(BigInt(1)).toBeGreaterThan(BigInt(0))
    expect(1).toBeGreaterThan(BigInt(0))
    expect(BigInt(1)).toBeGreaterThan(0)

    expect(1).toBeGreaterThanOrEqual(1)
    expect(1).toBeGreaterThanOrEqual(0)

    expect(BigInt(1)).toBeGreaterThanOrEqual(BigInt(1))
    expect(BigInt(1)).toBeGreaterThanOrEqual(BigInt(0))
    expect(BigInt(1)).toBeGreaterThanOrEqual(1)
    expect(1).toBeGreaterThanOrEqual(BigInt(1))

    expect(0).toBeLessThan(1)
    expect(BigInt(0)).toBeLessThan(BigInt(1))
    expect(BigInt(0)).toBeLessThan(1)

    expect(1).toBeLessThanOrEqual(1)
    expect(0).toBeLessThanOrEqual(1)
    expect(BigInt(1)).toBeLessThanOrEqual(BigInt(1))
    expect(BigInt(0)).toBeLessThanOrEqual(BigInt(1))
    expect(BigInt(1)).toBeLessThanOrEqual(1)
    expect(1).toBeLessThanOrEqual(BigInt(1))

    expect(() => {
      throw new Error('this is the error message')
    }).toThrow('this is the error message')
    expect(() => {}).not.toThrow()
    expect(() => {
      throw new TestError('error')
    }).toThrow(TestError)
    const err = new Error('hello world')
    expect(() => {
      throw err
    }).toThrow(err)
    expect(() => {
      throw new Error('message')
    }).toThrow(expect.objectContaining({
      message: expect.stringContaining('mes'),
    }))
    expect(() => {
      // eslint-disable-next-line no-throw-literal
      throw ''
    }).toThrow(/^$/)
    expect(() => {
      // eslint-disable-next-line no-throw-literal
      throw ''
    }).toThrow('')
    expect(() => {
      throw new Error('error')
    }).not.toThrowError('')
    expect([1, 2, 3]).toHaveLength(3)
    expect('abc').toHaveLength(3)
    expect('').not.toHaveLength(5)
    expect({ length: 3 }).toHaveLength(3)
    expect(0.2 + 0.1).not.toBe(0.3)
    expect(0.2 + 0.1).toBeCloseTo(0.3, 5)
    expect(0.2 + 0.1).not.toBeCloseTo(0.3, 100) // expect.closeTo will fail in chai

    expect(() => expect(1).toMatch(/\d/)).toThrowErrorMatchingInlineSnapshot(`[TypeError: .toMatch() expects to receive a string, but got number]`)
  })

  it('asymmetric matchers (jest style)', () => {
    expect({ foo: 'bar' }).toEqual({ foo: expect.stringContaining('ba') })
    expect('bar').toEqual(expect.stringContaining('ba'))
    expect(['bar']).toEqual([expect.stringContaining('ba')])
    expect(new Set(['bar'])).toEqual(new Set([expect.stringContaining('ba')]))
    expect(new Set(['bar'])).not.toEqual(new Set([expect.stringContaining('zoo')]))

    expect({ foo: 'bar' }).not.toEqual({ foo: expect.stringContaining('zoo') })
    expect('bar').not.toEqual(expect.stringContaining('zoo'))
    expect(['bar']).not.toEqual([expect.stringContaining('zoo')])

    expect({ foo: 'bar', bar: 'foo', hi: 'hello' }).toEqual({
      foo: expect.stringContaining('ba'),
      bar: expect.stringContaining('fo'),
      hi: 'hello',
    })
    expect(0).toEqual(expect.anything())
    expect({}).toEqual(expect.anything())
    expect('string').toEqual(expect.anything())
    expect(null).not.toEqual(expect.anything())
    expect(undefined).not.toEqual(expect.anything())
    expect({ a: 0, b: 0 }).toEqual(expect.objectContaining({ a: 0 }))
    expect({ a: 0, b: 0 }).not.toEqual(expect.objectContaining({ z: 0 }))
    expect(0).toEqual(expect.any(Number))
    expect('string').toEqual(expect.any(String))
    expect('string').not.toEqual(expect.any(Number))

    expect(['Bob', 'Eve']).toEqual(expect.arrayContaining(['Bob']))
    expect(['Bob', 'Eve']).not.toEqual(expect.arrayContaining(['Mohammad']))

    expect([
      { name: 'Bob' },
      { name: 'Eve' },
    ]).toEqual(expect.arrayContaining<{ name: string }>([
      { name: 'Bob' },
    ]))
    expect([
      { name: 'Bob' },
      { name: 'Eve' },
    ]).not.toEqual(expect.arrayContaining<{ name: string }>([
      { name: 'Mohammad' },
    ]))

    expect('Mohammad').toEqual(expect.stringMatching(/Moh/))
    expect('Mohammad').not.toEqual(expect.stringMatching(/jack/))
    expect({
      sum: 0.1 + 0.2,
    }).toEqual({
      sum: expect.closeTo(0.3, 5),
    })

    expect({
      sum: 0.1 + 0.2,
    }).not.toEqual({
      sum: expect.closeTo(0.4, 5),
    })

    expect({
      sum: 0.1 + 0.2,
    }).toEqual({
      sum: expect.not.closeTo(0.4, 5),
    })

    expect(() => {
      expect({
        sum: 0.1 + 0.2,
      }).toEqual({
        sum: expect.closeTo(0.4),
      })
    }).toThrowErrorMatchingInlineSnapshot(`[AssertionError: expected { sum: 0.30000000000000004 } to deeply equal { sum: NumberCloseTo 0.4 (2 digits) }]`)
  })

  it('asymmetric matchers and equality testers', () => {
    // iterable equality testers
    expect([new Set(['x'])]).toEqual(
      expect.arrayContaining([new Set(['x'])]),
    )
    expect([new Set()]).not.toEqual(
      expect.arrayContaining([new Set(['x'])]),
    )
    expect({ foo: new Set(['x']) }).toEqual(
      expect.objectContaining({ foo: new Set(['x']) }),
    )
    expect({ foo: new Set() }).not.toEqual(
      expect.objectContaining({ foo: new Set(['x']) }),
    )

    // `toStrictEqual` testers
    class Stock {
      constructor(public type: string) {}
    }
    expect([new Stock('x')]).toEqual(
      expect.arrayContaining([{ type: 'x' }]),
    )
    expect([new Stock('x')]).not.toStrictEqual(
      expect.arrayContaining([{ type: 'x' }]),
    )
    expect([new Stock('x')]).toStrictEqual(
      expect.arrayContaining([new Stock('x')]),
    )
  })

  it('asymmetric matchers negate', () => {
    expect('bar').toEqual(expect.not.stringContaining('zoo'))
    expect('bar').toEqual(expect.not.stringMatching(/zoo/))
    expect({ bar: 'zoo' }).toEqual(expect.not.objectContaining({ zoo: 'bar' }))
    expect(['Bob', 'Eve']).toEqual(expect.not.arrayContaining(['Steve']))
  })

  it('expect.extend', async () => {
    expect.extend({
      toBeDividedBy(received, divisor) {
        const pass = received % divisor === 0
        if (pass) {
          return {
            message: () =>
              `expected ${received} not to be divisible by ${divisor}`,
            pass: true,
          }
        }
        else {
          return {
            message: () =>
              `expected ${received} to be divisible by ${divisor}`,
            pass: false,
          }
        }
      },
      async toBeTestedAsync() {
        return {
          pass: false,
          message: () => 'toBeTestedAsync',
        }
      },
      toBeTestedSync() {
        return {
          pass: false,
          message: () => 'toBeTestedSync',
        }
      },
      toBeTestedPromise() {
        return Promise.resolve({
          pass: false,
          message: () => 'toBeTestedPromise',
        })
      },
      toBeJestCompatible() {
        return {
          pass: true,
          message: () => '',
        }
      },
    })

    expect(5).toBeDividedBy(5)
    expect(5).not.toBeDividedBy(4)
    expect({ one: 1, two: 2 }).toEqual({
      one: expect.toBeDividedBy(1),
      two: expect.not.toBeDividedBy(5),
    })
    expect(() => expect(2).toBeDividedBy(5)).toThrowError()

    expect(() => expect(null).toBeTestedSync()).toThrowError('toBeTestedSync')
    await expect(async () => await expect(null).toBeTestedAsync()).rejects.toThrowError('toBeTestedAsync')
    await expect(async () => await expect(null).toBeTestedPromise()).rejects.toThrowError('toBeTestedPromise')

    expect(expect).toBeJestCompatible()
  })

  it('object', () => {
    expect({}).toEqual({})
    expect({ apples: 13 }).toEqual({ apples: 13 })
    expect({}).toStrictEqual({})
    expect({}).not.toBe({})

    const foo = {}
    const complex = {
      '0': 'zero',
      'foo': 1,
      'foo.bar[0]': 'baz',
      'a-b': true,
      'a-b-1.0.0': true,
      'bar': {
        foo: 'foo',
        bar: 100,
        arr: ['first', { zoo: 'monkey' }],
      },
    }

    expect(foo).toBe(foo)
    expect(foo).toStrictEqual(foo)
    expect(complex).toMatchObject({})
    expect(complex).toMatchObject({ foo: 1 })
    expect([complex]).toMatchObject([{ foo: 1 }])
    expect(complex).not.toMatchObject({ foo: 2 })
    expect(complex).toMatchObject({ bar: { bar: 100 } })
    expect(complex).toMatchObject({ foo: expect.any(Number) })

    expect(complex).toHaveProperty('a-b')
    expect(complex).toHaveProperty('a-b-1.0.0')
    expect(complex).toHaveProperty('0')
    expect(complex).toHaveProperty('0', 'zero')
    expect(complex).toHaveProperty(['0'])
    expect(complex).toHaveProperty(['0'], 'zero')
    expect(complex).toHaveProperty([0])
    expect(complex).toHaveProperty([0], 'zero')
    expect(complex).toHaveProperty('foo')
    expect(complex).toHaveProperty('foo', 1)
    expect(complex).toHaveProperty('bar.foo', 'foo')
    expect(complex).toHaveProperty('bar.arr[0]')
    expect(complex).toHaveProperty('bar.arr[1].zoo', 'monkey')
    expect(complex).toHaveProperty('bar.arr.0')
    expect(complex).toHaveProperty(['bar', 'arr', '0'])
    expect(complex).toHaveProperty(['bar', 'arr', '0'], 'first')
    expect(complex).toHaveProperty(['bar', 'arr', 0])
    expect(complex).toHaveProperty(['bar', 'arr', 0], 'first')
    expect(complex).toHaveProperty('bar.arr.1.zoo', 'monkey')
    expect(complex).toHaveProperty(['bar', 'arr', '1', 'zoo'], 'monkey')
    expect(complex).toHaveProperty(['foo.bar[0]'], 'baz')

    expect(complex).toHaveProperty('foo', expect.any(Number))
    expect(complex).toHaveProperty('bar', expect.any(Object))
    expect(complex).toHaveProperty('bar.arr', expect.any(Array))
    expect(complex).toHaveProperty('bar.arr.0', expect.anything())

    expect(() => {
      expect(complex).toHaveProperty('some-unknown-property')
    }).toThrowError()

    expect(() => {
      expect(complex).toHaveProperty('a-b', false)
    }).toThrowErrorMatchingInlineSnapshot(`[AssertionError: expected { '0': 'zero', foo: 1, …(4) } to have property "a-b" with value false]`)

    expect(() => {
      const x = { a: { b: { c: 1 } } }
      const y = { a: { b: { c: 2 } } }
      Object.freeze(x.a)
      expect(x).toEqual(y)
    }).toThrowErrorMatchingInlineSnapshot(`[AssertionError: expected { a: { b: { c: 1 } } } to deeply equal { a: { b: { c: 2 } } }]`)
  })

  it('assertions', () => {
    expect(1).toBe(1)
    expect(1).toBe(1)
    expect(1).toBe(1)
    expect.assertions(3)
  })

  it('assertions with different order', () => {
    expect.assertions(3)
    expect(1).toBe(1)
    expect(1).toBe(1)
    expect(1).toBe(1)
  })

  it('assertions when asynchronous code', async () => {
    expect.assertions(3)
    await Promise.all([
      expect(1).toBe(1),
      expect(1).toBe(1),
      expect(1).toBe(1),
    ])
  })

  it.fails('assertions when asynchronous code', async () => {
    // Error: expected number of assertions to be 2, but got 3
    expect.assertions(2)
    await Promise.all([
      expect(1).toBe(1),
      expect(1).toBe(1),
      expect(1).toBe(1),
    ])
  })

  it.fails('has assertions', () => {
    expect.hasAssertions()
  })

  it('has assertions', () => {
    expect(1).toBe(1)
    expect.hasAssertions()
  })

  it('has assertions with different order', () => {
    expect.hasAssertions()
    expect(1).toBe(1)
  })

  it.fails('toBe with null/undefined values', () => {
    expect(undefined).toBe(true)
    expect(null).toBe(true)
  })

  // https://jestjs.io/docs/expect#tostrictequalvalue

  class LaCroix {
    constructor(public flavor: any) {}
  }

  describe('the La Croix cans on my desk', () => {
    it('are not semantically the same', () => {
      expect(new LaCroix('lemon')).toEqual({ flavor: 'lemon' })
      expect(new LaCroix('lemon')).not.toStrictEqual({ flavor: 'lemon' })
    })
  })

  it('array', () => {
    expect([]).toEqual([])
    expect([]).not.toBe([])
    expect([]).toStrictEqual([])

    const foo: any[] = []

    expect(foo).toBe(foo)
    expect(foo).toStrictEqual(foo)

    const complex = [
      {
        foo: 1,
        bar: { foo: 'foo', bar: 100, arr: ['first', { zoo: 'monkey' }] },
      },
    ]
    expect(complex).toStrictEqual([
      {
        foo: 1,
        bar: { foo: 'foo', bar: 100, arr: ['first', { zoo: 'monkey' }] },
      },
    ])
  })

  describe('toThrow', () => {
    it('error wasn\'t thrown', () => {
      expect(() => {
        expect(() => {
        }).toThrow(Error)
      }).toThrowErrorMatchingInlineSnapshot(`[AssertionError: expected function to throw an error, but it didn't]`)
    })

    it('async wasn\'t awaited', () => {
      expect(() => {
        expect(async () => {
        }).toThrow(Error)
      }).toThrowErrorMatchingInlineSnapshot(`[AssertionError: expected function to throw an error, but it didn't]`)
    })
  })
})

describe('.toStrictEqual()', () => {
  class TestClassA {
    constructor(public a: any, public b: any) {}
  }

  class TestClassB {
    constructor(public a: any, public b: any) {}
  }

  const TestClassC = class Child extends TestClassA {
    constructor(a: any, b: any) {
      super(a, b)
    }
  }

  const TestClassD = class Child extends TestClassB {
    constructor(a: any, b: any) {
      super(a, b)
    }
  }

  it('does not ignore keys with undefined values', () => {
    expect({
      a: undefined,
      b: 2,
    }).not.toStrictEqual({ b: 2 })
  })

  it('does not ignore keys with undefined values inside an array', () => {
    expect([{ a: undefined }]).not.toStrictEqual([{}])
  })

  it('does not ignore keys with undefined values deep inside an object', () => {
    expect([{ a: [{ a: undefined }] }]).not.toStrictEqual([{ a: [{}] }])
  })

  it('does not consider holes as undefined in sparse arrays', () => {
    expect([, , , 1, , ,]).not.toStrictEqual([, , , 1, undefined, ,])
  })

  it('passes when comparing same type', () => {
    expect({
      test: new TestClassA(1, 2),
    }).toStrictEqual({ test: new TestClassA(1, 2) })
  })

  it('does not pass for different types', () => {
    expect({
      test: new TestClassA(1, 2),
    }).not.toStrictEqual({ test: new TestClassB(1, 2) })
  })

  it('does not simply compare constructor names', () => {
    const c = new TestClassC(1, 2)
    const d = new TestClassD(1, 2)
    expect(c.constructor.name).toEqual(d.constructor.name)
    expect({ test: c }).not.toStrictEqual({ test: d })
  })

  it('passes for matching sparse arrays', () => {
    expect([, 1]).toStrictEqual([, 1])
  })

  it('does not pass when sparseness of arrays do not match', () => {
    expect([, 1]).not.toStrictEqual([undefined, 1])
    expect([undefined, 1]).not.toStrictEqual([, 1])
    expect([, , , 1]).not.toStrictEqual([, 1])
  })

  it('does not pass when equally sparse arrays have different values', () => {
    expect([, 1]).not.toStrictEqual([, 2])
  })

  it('does not pass when ArrayBuffers are not equal', () => {
    expect(Uint8Array.from([1, 2]).buffer).not.toStrictEqual(
      Uint8Array.from([0, 0]).buffer,
    )
    expect(Uint8Array.from([2, 1]).buffer).not.toStrictEqual(
      Uint8Array.from([2, 2]).buffer,
    )
    expect(Uint8Array.from([]).buffer).not.toStrictEqual(
      Uint8Array.from([1]).buffer,
    )
  })

  it('passes for matching buffers', () => {
    expect(Uint8Array.from([1]).buffer).toStrictEqual(
      Uint8Array.from([1]).buffer,
    )
    expect(Uint8Array.from([]).buffer).toStrictEqual(
      Uint8Array.from([]).buffer,
    )
    expect(Uint8Array.from([9, 3]).buffer).toStrictEqual(
      Uint8Array.from([9, 3]).buffer,
    )
  })

  it('does not pass for DataView', () => {
    expect(new DataView(Uint8Array.from([1, 2, 3]).buffer)).not.toStrictEqual(
      new DataView(Uint8Array.from([3, 2, 1]).buffer),
    )

    expect(new DataView(Uint16Array.from([1, 2]).buffer)).not.toStrictEqual(
      new DataView(Uint16Array.from([2, 1]).buffer),
    )
  })

  it('passes for matching DataView', () => {
    expect(new DataView(Uint8Array.from([1, 2, 3]).buffer)).toStrictEqual(
      new DataView(Uint8Array.from([1, 2, 3]).buffer),
    )
    expect(new DataView(Uint8Array.from([]).buffer)).toStrictEqual(
      new DataView(Uint8Array.from([]).buffer),
    )
  })
})

describe('toBeTypeOf()', () => {
  it.each([
    [1n, 'bigint'],
    [true, 'boolean'],
    [false, 'boolean'],
    [(() => {}) as () => void, 'function'],
    [function () {} as () => void, 'function'],
    [1, 'number'],
    [Number.POSITIVE_INFINITY, 'number'],
    [Number.NaN, 'number'],
    [0, 'number'],
    [{}, 'object'],
    [[], 'object'],
    [null, 'object'],
    ['', 'string'],
    ['test', 'string'],
    [Symbol('test'), 'symbol'],
    [undefined, 'undefined'],
  ] as const)('pass with typeof %s === %s', (actual, expected) => {
    expect(actual).toBeTypeOf(expected)
  })

  it('pass with negotiation', () => {
    expect('test').not.toBeTypeOf('number')
  })
})

describe('toBeOneOf()', () => {
  it('pass with assertion', () => {
    expect(0).toBeOneOf([0, 1, 2])
    expect(0).toBeOneOf([expect.any(Number)])
    expect('apple').toBeOneOf(['apple', 'banana', 'orange'])
    expect('apple').toBeOneOf([expect.any(String)])
    expect(true).toBeOneOf([true, false])
    expect(true).toBeOneOf([expect.any(Boolean)])
    expect(null).toBeOneOf([expect.any(Object)])
    expect(undefined).toBeOneOf([undefined])
  })

  it('pass with negotiation', () => {
    expect(3).not.toBeOneOf([0, 1, 2])
    expect(3).not.toBeOneOf([expect.any(String)])
    expect('mango').not.toBeOneOf(['apple', 'banana', 'orange'])
    expect('mango').not.toBeOneOf([expect.any(Number)])
    expect(null).not.toBeOneOf([undefined])
  })

  it.fails('fail with missing negotiation', () => {
    expect(3).toBeOneOf([0, 1, 2])
    expect(3).toBeOneOf([expect.any(String)])
    expect('mango').toBeOneOf(['apple', 'banana', 'orange'])
    expect('mango').toBeOneOf([expect.any(Number)])
    expect(null).toBeOneOf([undefined])
  })

  it('asymmetric matcher', () => {
    expect({ a: 0 }).toEqual(expect.toBeOneOf([expect.objectContaining({ a: 0 }), null]))
    expect({
      name: 'apple',
      count: 1,
    }).toEqual({
      name: expect.toBeOneOf(['apple', 'banana', 'orange']),
      count: expect.toBeOneOf([expect.any(Number)]),
    })
  })

  it('error message', () => {
    snapshotError(() => expect(3).toBeOneOf([0, 1, 2]))
    snapshotError(() => expect(3).toBeOneOf([expect.any(String)]))
    snapshotError(() => expect({ a: 0 }).toEqual(expect.toBeOneOf([expect.objectContaining({ b: 0 }), null, undefined])))
    snapshotError(() => expect({ name: 'mango' }).toEqual({ name: expect.toBeOneOf(['apple', 'banana', 'orange']) }))
  })
})

describe('toSatisfy()', () => {
  const isOdd = (value: number) => value % 2 !== 0

  it('pass with 0', () => {
    expect(1).toSatisfy(isOdd)
  })

  it('pass with negotiation', () => {
    expect(2).not.toSatisfy(isOdd)
  })

  it.fails('fail with missing negotiation', () => {
    expect(2).toSatisfy(isOdd)
  })

  it('calls the function', () => {
    const isOddMock = vi.fn(isOdd)
    expect(isOddMock).not.toBeCalled()
    expect(1).toSatisfy(isOddMock)
    expect(isOddMock).toBeCalled()
  })

  it('asymmetric matcher', () => {
    expect({ value: 1 }).toEqual({ value: expect.toSatisfy(isOdd) })
    expect(() => {
      expect({ value: 2 }).toEqual({ value: expect.toSatisfy(isOdd, 'odd') })
    }).toThrowErrorMatchingInlineSnapshot(
      `[AssertionError: expected { value: 2 } to deeply equal { value: toSatisfy{…} }]`,
    )

    expect(() => {
      throw new Error('1')
    }).toThrow(
      expect.toSatisfy((e) => {
        assert(e instanceof Error)
        expect(e).toMatchObject({ message: expect.toSatisfy(isOdd) })
        return true
      }),
    )

    expect(() => {
      expect(() => {
        throw new Error('2')
      }).toThrow(
        expect.toSatisfy((e) => {
          assert(e instanceof Error)
          expect(e).toMatchObject({ message: expect.toSatisfy(isOdd) })
          return true
        }),
      )
    }).toThrowErrorMatchingInlineSnapshot(
      `[AssertionError: expected Error: 2 to match object { Object (message) }]`,
    )
  })

  it('error message', () => {
    snapshotError(() => expect(2).toSatisfy(isOdd))
    snapshotError(() => expect(2).toSatisfy(isOdd, 'ODD'))
    snapshotError(() => expect({ value: 2 }).toEqual({ value: expect.toSatisfy(isOdd) }))
    snapshotError(() => expect({ value: 2 }).toEqual({ value: expect.toSatisfy(isOdd, 'ODD') }))
  })
})

describe('toHaveBeenCalled', () => {
  describe('negated', () => {
    it('fails if called', () => {
      const mock = vi.fn()
      mock()

      expect(() => {
        expect(mock).not.toHaveBeenCalled()
      }).toThrow(/^expected "spy" to not be called at all[^e]/)
    })
  })
})

describe('toHaveBeenCalledWith', () => {
  describe('negated', () => {
    it('fails if called', () => {
      const mock = vi.fn()
      mock(3)

      expect(() => {
        expect(mock).not.toHaveBeenCalledWith(3)
      }).toThrow(/^expected "spy" to not be called with arguments: \[ 3 \][^e]/)
    })
  })
})

describe('toHaveBeenCalledExactlyOnceWith', () => {
  describe('negated', () => {
    it('fails if called', () => {
      const mock = vi.fn()
      mock(3)

      expect(() => {
        expect(mock).not.toHaveBeenCalledExactlyOnceWith(3)
      }).toThrow(/^expected "spy" to not be called once with arguments: \[ 3 \][^e]/)
    })

    it('passes if called multiple times with args', () => {
      const mock = vi.fn()
      mock(3)
      mock(3)

      expect(mock).not.toHaveBeenCalledExactlyOnceWith(3)
    })

    it('passes if not called', () => {
      const mock = vi.fn()
      expect(mock).not.toHaveBeenCalledExactlyOnceWith(3)
    })

    it('passes if called with a different argument', () => {
      const mock = vi.fn()
      mock(4)

      expect(mock).not.toHaveBeenCalledExactlyOnceWith(3)
    })
  })

  it('fails if not called or called too many times', () => {
    const mock = vi.fn()

    expect(() => {
      expect(mock).toHaveBeenCalledExactlyOnceWith(3)
    }).toThrow(/^expected "spy" to be called once with arguments: \[ 3 \][^e]/)

    mock(3)
    mock(3)

    expect(() => {
      expect(mock).toHaveBeenCalledExactlyOnceWith(3)
    }).toThrow(/^expected "spy" to be called once with arguments: \[ 3 \][^e]/)
  })

  it('fails if called with wrong args', () => {
    const mock = vi.fn()
    mock(4)

    expect(() => {
      expect(mock).toHaveBeenCalledExactlyOnceWith(3)
    }).toThrow(/^expected "spy" to be called once with arguments: \[ 3 \][^e]/)
  })

  it('passes if called exactly once with args', () => {
    const mock = vi.fn()
    mock(3)

    expect(mock).toHaveBeenCalledExactlyOnceWith(3)
  })
})

describe('toHaveBeenCalledBefore', () => {
  it('success if expect mock is called before result mock', () => {
    const expectMock = vi.fn()
    const resultMock = vi.fn()

    expectMock()
    resultMock()

    expect(expectMock).toHaveBeenCalledBefore(resultMock)
  })

  it('throws if expect is not a spy', () => {
    expect(() => {
      expect(1).toHaveBeenCalledBefore(vi.fn())
    }).toThrow(/^1 is not a spy or a call to a spy/)
  })

  it('throws if result is not a spy', () => {
    expect(() => {
      expect(vi.fn()).toHaveBeenCalledBefore(1 as any)
    }).toThrow(/^1 is not a spy or a call to a spy/)
  })

  it('throws if expect mock is called after result mock', () => {
    const expectMock = vi.fn()
    const resultMock = vi.fn()

    resultMock()
    expectMock()

    expect(() => {
      expect(expectMock).toHaveBeenCalledBefore(resultMock)
    }).toThrow(/^expected "spy" to have been called before "spy"/)
  })

  it('throws with correct mock name if failed', () => {
    const mock1 = vi.fn().mockName('mock1')
    const mock2 = vi.fn().mockName('mock2')

    mock2()
    mock1()

    expect(() => {
      expect(mock1).toHaveBeenCalledBefore(mock2)
    }).toThrow(/^expected "mock1" to have been called before "mock2"/)
  })

  it('fails if expect mock is not called', () => {
    const resultMock = vi.fn()

    resultMock()

    expect(() => {
      expect(vi.fn()).toHaveBeenCalledBefore(resultMock)
    }).toThrow(/^expected "spy" to have been called before "spy"/)
  })

  it('not fails if expect mock is not called with option `failIfNoFirstInvocation` set to false', () => {
    const resultMock = vi.fn()

    resultMock()

    expect(vi.fn()).toHaveBeenCalledBefore(resultMock, false)
  })

  it('fails if result mock is not called', () => {
    const expectMock = vi.fn()

    expectMock()

    expect(() => {
      expect(expectMock).toHaveBeenCalledBefore(vi.fn())
    }).toThrow(/^expected "spy" to have been called before "spy"/)
  })
})

describe('toHaveBeenCalledAfter', () => {
  it('success if expect mock is called after result mock', () => {
    const resultMock = vi.fn()
    const expectMock = vi.fn()

    resultMock()
    expectMock()

    expect(expectMock).toHaveBeenCalledAfter(resultMock)
  })

  it('throws if expect is not a spy', () => {
    expect(() => {
      expect(1).toHaveBeenCalledAfter(vi.fn())
    }).toThrow(/^1 is not a spy or a call to a spy/)
  })

  it('throws if result is not a spy', () => {
    expect(() => {
      expect(vi.fn()).toHaveBeenCalledAfter(1 as any)
    }).toThrow(/^1 is not a spy or a call to a spy/)
  })

  it('throws if expect mock is called before result mock', () => {
    const resultMock = vi.fn()
    const expectMock = vi.fn()

    expectMock()
    resultMock()

    expect(() => {
      expect(expectMock).toHaveBeenCalledAfter(resultMock)
    }).toThrow(/^expected "spy" to have been called after "spy"/)
  })

  it('throws with correct mock name if failed', () => {
    const mock1 = vi.fn().mockName('mock1')
    const mock2 = vi.fn().mockName('mock2')

    mock1()
    mock2()

    expect(() => {
      expect(mock1).toHaveBeenCalledAfter(mock2)
    }).toThrow(/^expected "mock1" to have been called after "mock2"/)
  })

  it('fails if result mock is not called', () => {
    const expectMock = vi.fn()

    expectMock()

    expect(() => {
      expect(expectMock).toHaveBeenCalledAfter(vi.fn())
    }).toThrow(/^expected "spy" to have been called after "spy"/)
  })

  it('not fails if result mock is not called with option `failIfNoFirstInvocation` set to false', () => {
    const expectMock = vi.fn()

    expectMock()

    expect(expectMock).toHaveBeenCalledAfter(vi.fn(), false)
  })

  it('fails if expect mock is not called', () => {
    const resultMock = vi.fn()

    resultMock()

    expect(() => {
      expect(vi.fn()).toHaveBeenCalledAfter(resultMock)
    }).toThrow(/^expected "spy" to have been called after "spy"/)
  })
})

describe('async expect', () => {
  it('resolves', async () => {
    await expect((async () => 'true')()).resolves.toBe('true')
    await expect((async () => 'true')()).resolves.not.toBe('true22')
    await expect((async () => 'true')()).resolves.not.toThrow()
    await expect((async () => new Error('msg'))()).resolves.not.toThrow() // calls chai assertion
    await expect((async () => new Error('msg'))()).resolves.not.toThrow(Error) // calls our assertion
    await expect((async () => () => {
      throw new Error('msg')
    })()).resolves.toThrow()
    await expect((async () => () => {
      return new Error('msg')
    })()).resolves.not.toThrow()
    await expect((async () => () => {
      return new Error('msg')
    })()).resolves.not.toThrow(Error)
  })

  it('resolves throws chai', async () => {
    const assertion = async () => {
      await expect((async () => new Error('msg'))()).resolves.toThrow()
    }

    await expect(assertion).rejects.toThrowError('expected promise to throw an error, but it didn\'t')
  })

  it('resolves throws jest', async () => {
    const assertion = async () => {
      await expect((async () => new Error('msg'))()).resolves.toThrow(Error)
    }

    await expect(assertion).rejects.toThrowError('expected promise to throw an error, but it didn\'t')
  })

  it('throws an error on .resolves when the argument is not a promise', () => {
    expect.assertions(2)

    const expectedError = new TypeError('You must provide a Promise to expect() when using .resolves, not \'number\'.')

    try {
      expect(1).resolves.toEqual(2)
      expect.unreachable()
    }
    catch (error) {
      expect(error).toEqual(expectedError)
    }
  })

  it.fails('failed to resolve', async () => {
    await expect((async () => {
      throw new Error('err')
    })()).resolves.toBe('true')
  })

  it.fails('failed to throw', async () => {
    await expect((async () => {
      throw new Error('err')
    })()).resolves.not.toThrow()
  })

  it('rejects', async () => {
    await expect((async () => {
      throw new Error('err')
    })()).rejects.toStrictEqual(new Error('err'))
    await expect((async () => {
      throw new Error('err')
    })()).rejects.toThrow('err')
    await expect((async () => {
      throw new TestError('error')
    })()).rejects.toThrow(TestError)
    const err = new Error('hello world')
    await expect((async () => {
      throw err
    })()).rejects.toThrow(err)
    await expect((async () => {
      throw new Error('message')
    })()).rejects.toThrow(expect.objectContaining({
      message: expect.stringContaining('mes'),
    }))

    await expect((async () => {
      throw new Error('err')
    })()).rejects.not.toStrictEqual(new Error('fake err'))
  })

  it.fails('failed to reject', async () => {
    await expect((async () => 'test')()).rejects.toBe('test')
  })

  it('throws an error on .rejects when the argument (or function result) is not a promise', () => {
    expect.assertions(4)

    const expectedError = new TypeError('You must provide a Promise to expect() when using .rejects, not \'number\'.')

    try {
      expect(1).rejects.toEqual(2)
      expect.unreachable()
    }
    catch (error) {
      expect(error).toEqual(expectedError)
    }

    try {
      expect(() => 1).rejects.toEqual(2)
      expect.unreachable()
    }
    catch (error) {
      expect(error).toEqual(expectedError)
    }
  })

  it('reminds users to use deep equality checks if they are comparing objects', () => {
    const generatedToBeMessage = (
      deepEqualityName: string,
      expected: string,
      actual: string,
    ) => new AssertionError({
      message: generateToBeMessage(deepEqualityName, expected, actual),
    })

    const actual = { key: 'value' }
    class FakeClass {}

    const toStrictEqualError1 = generatedToBeMessage('toStrictEqual', '{ key: \'value\' }', '{ key: \'value\' }')
    try {
      expect(actual).toBe({ ...actual })
      expect.unreachable()
    }
    catch (error: any) {
      expect(error.message).toBe(toStrictEqualError1.message)
    }

    const toStrictEqualError2 = generatedToBeMessage('toStrictEqual', 'FakeClass{}', 'FakeClass{}')
    try {
      expect(new FakeClass()).toBe(new FakeClass())
      expect.unreachable()
    }
    catch (error: any) {
      expect(error.message).toBe(toStrictEqualError2.message)
    }

    const toEqualError1 = generatedToBeMessage('toEqual', '{}', 'FakeClass{}')
    try {
      expect({}).toBe(new FakeClass())
      expect.unreachable()
    }
    catch (error: any) {
      expect(error.message).toBe(toEqualError1.message)
    }

    const toEqualError2 = generatedToBeMessage('toEqual', 'FakeClass{}', '{}')
    try {
      expect(new FakeClass()).toBe({})
      expect.unreachable()
    }
    catch (error: any) {
      expect(error.message).toBe(toEqualError2.message)
    }
  })

  describe('promise auto queuing', () => {
    // silence warning
    beforeAll(() => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      return () => spy.mockRestore()
    })

    it.fails('fails', () => {
      expect(new Promise((resolve, reject) => setTimeout(reject, 500)))
        .resolves
        .toBe('true')
    })

    let value = 0

    it('pass first', () => {
      expect((async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        value += 1
        return value
      })())
        .resolves
        .toBe(1)
    })

    it('pass second', () => {
    // even if 'pass first' is sync, we will still wait the expect to resolve
      expect(value).toBe(1)
    })
  })

  it('printing error message', async () => {
    try {
      await expect(Promise.resolve({ foo: { bar: 42 } })).rejects.toThrow()
      expect.unreachable()
    }
    catch (err: any) {
      expect(err.message).toMatchInlineSnapshot(`"promise resolved "{ foo: { bar: 42 } }" instead of rejecting"`)
      expect(err.stack).toContain('jest-expect.test.ts')
    }

    try {
      const error = new Error('some error')
      Object.assign(error, { foo: { bar: 42 } })
      await expect(Promise.reject(error)).resolves.toBe(1)
      expect.unreachable()
    }
    catch (err: any) {
      expect(err.message).toMatchInlineSnapshot(`"promise rejected "Error: some error { foo: { bar: 42 } }" instead of resolving"`)
      expect(err.cause).toBeDefined()
      expect(err.cause.message).toMatchInlineSnapshot(`"some error"`)
      expect(err.stack).toContain('jest-expect.test.ts')
    }
  })

  it('handle thenable objects', async () => {
    await expect({ then: (resolve: any) => resolve(0) }).resolves.toBe(0)
    await expect({ then: (_: any, reject: any) => reject(0) }).rejects.toBe(0)

    try {
      await expect({ then: (resolve: any) => resolve(0) }).rejects.toBe(0)
      expect.unreachable()
    }
    catch (error) {
      expect(error).toMatchObject({ message: 'promise resolved "+0" instead of rejecting' })
    }

    try {
      await expect({ then: (_: any, reject: any) => reject(0) }).resolves.toBe(0)
      expect.unreachable()
    }
    catch (error) {
      expect(error).toMatchObject({ message: 'promise rejected "+0" instead of resolving' })
    }
  })
})

it('compatible with jest', () => {
  expect.extend({
    someObject() {
      return { pass: true, message: () => '' }
    },
  })
  const { matchers, state } = (globalThis as any)[Symbol.for('$$jest-matchers-object')]
  expect(matchers).toHaveProperty('someObject')
  expect(matchers).toHaveProperty('toBe')
  expect(state.assertionCalls).toBe(2)
})

it('correctly prints diff', () => {
  try {
    expect({ a: 1 }).toEqual({ a: 2 })
    expect.unreachable()
  }
  catch (err) {
    const error = processError(err)
    const diff = stripVTControlCharacters(error.diff)
    expect(diff).toContain('-   "a": 2')
    expect(diff).toContain('+   "a": 1')
  }
})

it('correctly prints diff for the cause', () => {
  try {
    expect({ a: 1 }).toEqual({ a: 2 })
    expect.unreachable()
  }
  catch (err) {
    const error = processError(new Error('wrapper', { cause: err }))
    const diff = stripVTControlCharacters(error.cause.diff)
    expect(diff).toContain('-   "a": 2')
    expect(diff).toContain('+   "a": 1')
  }
})

it('correctly prints diff with asymmetric matchers', () => {
  try {
    expect({ a: 1, b: 'string' }).toEqual({
      a: expect.any(Number),
      b: expect.any(Function),
    })
    expect.unreachable()
  }
  catch (err) {
    const error = processError(err)
    expect(stripVTControlCharacters(error.diff)).toMatchInlineSnapshot(`
      "- Expected
      + Received

        {
          "a": Any<Number>,
      -   "b": Any<Function>,
      +   "b": "string",
        }"
    `)
  }
})

// make it easy for dev who trims trailing whitespace on IDE
function trim(s: string): string {
  return s.replaceAll(/ *$/gm, '')
}

function getError(f: () => unknown) {
  try {
    f()
  }
  catch (error) {
    const processed = processError(error)
    return [stripVTControlCharacters(processed.message), stripVTControlCharacters(trim(processed.diff))]
  }
  return expect.unreachable()
}

it('toMatchObject error diff', () => {
  // single property on root (3 total properties, 1 expected)
  expect(getError(() => expect({ a: 1, b: 2, c: 3 }).toMatchObject({ c: 4 }))).toMatchInlineSnapshot(`
    [
      "expected { a: 1, b: 2, c: 3 } to match object { c: 4 }
    (2 matching properties omitted from actual)",
      "- Expected
    + Received

      {
    -   "c": 4,
    +   "c": 3,
      }",
    ]
  `)

  // single property on root (4 total properties, 1 expected)
  expect(getError(() => expect({ a: 1, b: 2, c: { d: 4 } }).toMatchObject({ b: 3 }))).toMatchInlineSnapshot(`
    [
      "expected { a: 1, b: 2, c: { d: 4 } } to match object { b: 3 }
    (3 matching properties omitted from actual)",
      "- Expected
    + Received

      {
    -   "b": 3,
    +   "b": 2,
      }",
    ]
  `)

  // nested property (7 total properties, 2 expected)
  expect(getError(() => expect({ a: 1, b: 2, c: { d: 4, e: 5 }, f: { g: 6 } }).toMatchObject({ c: { d: 5 } }))).toMatchInlineSnapshot(`
    [
      "expected { a: 1, b: 2, c: { d: 4, e: 5 }, …(1) } to match object { c: { d: 5 } }
    (5 matching properties omitted from actual)",
      "- Expected
    + Received

      {
        "c": {
    -     "d": 5,
    +     "d": 4,
        },
      }",
    ]
  `)

  // 3 total properties, 3 expected (0 stripped)
  expect(getError(() => expect({ a: 1, b: 2, c: 3 }).toMatchObject({ a: 1, b: 2, c: 4 }))).toMatchInlineSnapshot(`
    [
      "expected { a: 1, b: 2, c: 3 } to match object { a: 1, b: 2, c: 4 }",
      "- Expected
    + Received

      {
        "a": 1,
        "b": 2,
    -   "c": 4,
    +   "c": 3,
      }",
    ]
  `)

  // 4 total properties, 3 expected
  expect(getError(() => expect({ a: 1, b: 2, c: { d: 3 } }).toMatchObject({ a: 1, c: { d: 4 } }))).toMatchInlineSnapshot(`
    [
      "expected { a: 1, b: 2, c: { d: 3 } } to match object { a: 1, c: { d: 4 } }
    (1 matching property omitted from actual)",
      "- Expected
    + Received

      {
        "a": 1,
        "c": {
    -     "d": 4,
    +     "d": 3,
        },
      }",
    ]
  `)

  // 8 total properties, 4 expected
  expect(getError(() => expect({ a: 1, b: 2, c: { d: 4 }, foo: { value: 'bar' }, bar: { value: 'foo' } }).toMatchObject({ c: { d: 5 }, foo: { value: 'biz' } }))).toMatchInlineSnapshot(`
    [
      "expected { a: 1, b: 2, c: { d: 4 }, …(2) } to match object { c: { d: 5 }, foo: { value: 'biz' } }
    (4 matching properties omitted from actual)",
      "- Expected
    + Received

      {
        "c": {
    -     "d": 5,
    +     "d": 4,
        },
        "foo": {
    -     "value": "biz",
    +     "value": "bar",
        },
      }",
    ]
  `)

  // 8 total properties, 3 expected
  const characters = { firstName: 'Vladimir', lastName: 'Harkonnen', family: 'House Harkonnen', colors: ['red', 'blue'], children: [{ firstName: 'Jessica', lastName: 'Atreides', colors: ['red', 'green', 'black'] }] }
  expect(getError(() => expect(characters).toMatchObject({ family: 'House Atreides', children: [{ firstName: 'Paul' }] }))).toMatchInlineSnapshot(`
    [
      "expected { firstName: 'Vladimir', …(4) } to match object { family: 'House Atreides', …(1) }
    (5 matching properties omitted from actual)",
      "- Expected
    + Received

      {
        "children": [
          {
    -       "firstName": "Paul",
    +       "firstName": "Jessica",
          },
        ],
    -   "family": "House Atreides",
    +   "family": "House Harkonnen",
      }",
    ]
  `)

  // https://github.com/vitest-dev/vitest/issues/6543
  class Foo {
    constructor(public value: any) {}
  }

  class Bar {
    constructor(public value: any) {}
  }

  expect(new Foo(0)).toMatchObject(new Bar(0))
  expect(new Foo(0)).toMatchObject({ value: 0 })
  expect({ value: 0 }).toMatchObject(new Bar(0))

  expect(getError(() => expect(new Foo(0)).toMatchObject(new Bar(1)))).toMatchInlineSnapshot(`
    [
      "expected Foo{ value: +0 } to match object Bar{ value: 1 }",
      "- Expected
    + Received

    - Bar {
    -   "value": 1,
    + Foo {
    +   "value": 0,
      }",
    ]
  `)

  expect(getError(() => expect(new Foo(0)).toMatchObject({ value: 1 }))).toMatchInlineSnapshot(`
    [
      "expected Foo{ value: +0 } to match object { value: 1 }",
      "- Expected
    + Received

    - {
    -   "value": 1,
    + Foo {
    +   "value": 0,
      }",
    ]
  `)

  expect(getError(() => expect({ value: 0 }).toMatchObject(new Bar(1)))).toMatchInlineSnapshot(`
    [
      "expected { value: +0 } to match object Bar{ value: 1 }",
      "- Expected
    + Received

    - Bar {
    -   "value": 1,
    + {
    +   "value": 0,
      }",
    ]
  `)

  expect(getError(() =>
    expect({
      bad: new Foo(1),
      good: new Foo(0),
    }).toMatchObject({
      bad: new Bar(2),
      good: new Bar(0),
    }),
  )).toMatchInlineSnapshot(`
    [
      "expected { bad: Foo{ value: 1 }, …(1) } to match object { bad: Bar{ value: 2 }, …(1) }",
      "- Expected
    + Received

      {
    -   "bad": Bar {
    -     "value": 2,
    +   "bad": Foo {
    +     "value": 1,
        },
        "good": Bar {
          "value": 0,
        },
      }",
    ]
  `)

  expect(getError(() =>
    expect(new Foo(new Foo(1))).toMatchObject(new Bar(new Bar(0))),
  )).toMatchInlineSnapshot(`
    [
      "expected Foo{ value: Foo{ value: 1 } } to match object Bar{ value: Bar{ value: +0 } }",
      "- Expected
    + Received

    - Bar {
    -   "value": Bar {
    -     "value": 0,
    + Foo {
    +   "value": Foo {
    +     "value": 1,
        },
      }",
    ]
  `)

  expect(new Foo(new Foo(1))).toMatchObject(new Bar(new Foo(1)))
  expect(getError(() =>
    expect(new Foo(new Foo(1))).toMatchObject(new Bar(new Foo(2))),
  )).toMatchInlineSnapshot(`
    [
      "expected Foo{ value: Foo{ value: 1 } } to match object Bar{ value: Foo{ value: 2 } }",
      "- Expected
    + Received

    - Bar {
    + Foo {
        "value": Foo {
    -     "value": 2,
    +     "value": 1,
        },
      }",
    ]
  `)
})

it('toHaveProperty error diff', () => {
  // non match value
  expect(getError(() => expect({ name: 'foo' }).toHaveProperty('name', 'bar'))).toMatchInlineSnapshot(`
    [
      "expected { name: 'foo' } to have property "name" with value 'bar'",
      "Expected: "bar"
    Received: "foo"",
    ]
  `)

  // non match key
  expect(getError(() => expect({ noName: 'foo' }).toHaveProperty('name', 'bar'))).toMatchInlineSnapshot(`
    [
      "expected { noName: 'foo' } to have property "name" with value 'bar'",
      "- Expected:
    "bar"

    + Received:
    undefined",
    ]
  `)

  // non match value (with asymmetric matcher)
  expect(getError(() => expect({ name: 'foo' }).toHaveProperty('name', expect.any(Number)))).toMatchInlineSnapshot(`
    [
      "expected { name: 'foo' } to have property "name" with value Any<Number>",
      "- Expected:
    Any<Number>

    + Received:
    "foo"",
    ]
  `)

  // non match key (with asymmetric matcher)
  expect(getError(() => expect({ noName: 'foo' }).toHaveProperty('name', expect.any(Number)))).toMatchInlineSnapshot(`
    [
      "expected { noName: 'foo' } to have property "name" with value Any<Number>",
      "- Expected:
    Any<Number>

    + Received:
    undefined",
    ]
  `)

  // non match value (deep key)
  expect(getError(() => expect({ parent: { name: 'foo' } }).toHaveProperty('parent.name', 'bar'))).toMatchInlineSnapshot(`
    [
      "expected { parent: { name: 'foo' } } to have property "parent.name" with value 'bar'",
      "Expected: "bar"
    Received: "foo"",
    ]
  `)

  // non match key (deep key)
  expect(getError(() => expect({ parent: { noName: 'foo' } }).toHaveProperty('parent.name', 'bar'))).toMatchInlineSnapshot(`
    [
      "expected { parent: { noName: 'foo' } } to have property "parent.name" with value 'bar'",
      "- Expected:
    "bar"

    + Received:
    undefined",
    ]
  `)
})

function snapshotError(f: () => unknown) {
  try {
    f()
  }
  catch (error) {
    const e = processError(error)
    expect({
      message: stripVTControlCharacters(e.message),
      diff: e.diff ? stripVTControlCharacters(e.diff) : e.diff,
      expected: e.expected,
      actual: e.actual,
    }).toMatchSnapshot()
    return
  }
  expect.unreachable()
}

it('asymmetric matcher error', () => {
  expect.extend({
    stringContainingCustom(received: unknown, other: string) {
      return {
        pass: typeof received === 'string' && received.includes(other),
        message: () => `expected ${this.utils.printReceived(received)} ${this.isNot ? 'not ' : ''}to contain ${this.utils.printExpected(other)}`,
      }
    },
  })

  // builtin: stringContaining
  snapshotError(() => expect('hello').toEqual(expect.stringContaining('xx')))
  snapshotError(() => expect('hello').toEqual(expect.not.stringContaining('ll')))
  snapshotError(() => expect({ foo: 'hello' }).toEqual({ foo: expect.stringContaining('xx') }))
  snapshotError(() => expect({ foo: 'hello' }).toEqual({ foo: expect.not.stringContaining('ll') }))

  // custom
  snapshotError(() => expect('hello').toEqual((expect as any).stringContainingCustom('xx')))
  snapshotError(() => expect('hello').toEqual((expect as any).not.stringContainingCustom('ll')))
  snapshotError(() => expect({ foo: 'hello' }).toEqual({ foo: (expect as any).stringContainingCustom('xx') }))
  snapshotError(() => expect({ foo: 'hello' }).toEqual({ foo: (expect as any).not.stringContainingCustom('ll') }))

  // assertion form
  snapshotError(() => (expect('hello') as any).stringContainingCustom('xx'))
  snapshotError(() => (expect('hello') as any).not.stringContainingCustom('ll'))

  // matcher with complex argument
  // (serialized by `String` so it becomes "testComplexMatcher<[object Object]>", which is same as jest's asymmetric matcher and pretty-format)
  expect.extend({
    testComplexMatcher(_received: unknown, _arg: unknown) {
      return {
        pass: false,
        message: () => `NA`,
      }
    },
  })
  snapshotError(() => expect('hello').toEqual((expect as any).testComplexMatcher({ x: 'y' })))

  // more builtins
  snapshotError(() => expect({ k: 'v', k2: 'v2' }).toEqual(expect.objectContaining({ k: 'v', k3: 'v3' })))
  snapshotError(() => expect(['a', 'b']).toEqual(expect.arrayContaining(['a', 'c'])))
  snapshotError(() => expect('hello').toEqual(expect.stringMatching(/xx/)))
  snapshotError(() => expect(2.5).toEqual(expect.closeTo(2, 1)))
  snapshotError(() => expect('foo').toEqual(expect.toBeOneOf(['bar', 'baz'])))
  snapshotError(() => expect(0).toEqual(expect.toBeOneOf([expect.any(String), null, undefined])))
  snapshotError(() => expect({ k: 'v', k2: 'v2' }).toEqual(expect.toBeOneOf([expect.objectContaining({ k: 'v', k3: 'v3' }), null, undefined])))

  // simple truncation if pretty-format is too long
  snapshotError(() => expect('hello').toEqual(expect.stringContaining('a'.repeat(40))))

  // error message on `toThrow(asymmetricMatcher)` failure
  function throwError() {
    // eslint-disable-next-line no-throw-literal
    throw 'hello'
  }
  snapshotError(() => expect(throwError).toThrow(expect.stringContaining('xx')))
  snapshotError(() => expect(throwError).toThrow((expect as any).stringContainingCustom('xx')))
  snapshotError(() => expect(throwError).not.toThrow(expect.stringContaining('ll')))
  snapshotError(() => expect(throwError).not.toThrow((expect as any).stringContainingCustom('ll')))

  snapshotError(() => expect(() => {
    throw new Error('hello')
  }).toThrow(expect.stringContaining('ll')))
  snapshotError(() => expect(() => {
    throw new Error('hello')
  }).toThrow((expect as any).stringContainingCustom('ll')))

  // error constructor
  class MyError1 extends Error {}
  class MyError2 extends Error {}

  snapshotError(() => expect(() => {
    throw new MyError2('hello')
  }).toThrow(MyError1))
})

it('error equality', () => {
  class MyError extends Error {
    constructor(message: string, public custom: string) {
      super(message)
    }
  }

  class YourError extends Error {
    constructor(message: string, public custom: string) {
      super(message)
    }
  }

  {
    // different custom property
    const e1 = new MyError('hi', 'a')
    const e2 = new MyError('hi', 'b')
    snapshotError(() => expect(e1).toEqual(e2))
    expect(e1).not.toEqual(e2)
    expect(e1).not.toStrictEqual(e2)
    assert.deepEqual(e1, e2)
    nodeAssert.notDeepStrictEqual(e1, e2)

    // toThrowError also compare errors similar to toEqual
    snapshotError(() =>
      expect(() => {
        throw e1
      }).toThrowError(e2),
    )
  }

  {
    // different message
    const e1 = new MyError('hi', 'a')
    const e2 = new MyError('hello', 'a')
    snapshotError(() => expect(e1).toEqual(e2))
    expect(e1).not.toEqual(e2)
    expect(e1).not.toStrictEqual(e2)
    assert.notDeepEqual(e1, e2)
    nodeAssert.notDeepStrictEqual(e1, e2)
  }

  {
    // different class
    const e1 = new MyError('hello', 'a')
    const e2 = new YourError('hello', 'a')
    snapshotError(() => expect(e1).toEqual(e2))
    expect(e1).not.toEqual(e2)
    expect(e1).not.toStrictEqual(e2) // toStrictEqual checks constructor already
    assert.deepEqual(e1, e2)
    nodeAssert.notDeepStrictEqual(e1, e2)
  }

  {
    // same
    const e1 = new MyError('hi', 'a')
    const e2 = new MyError('hi', 'a')
    expect(e1).toEqual(e2)
    expect(e1).toStrictEqual(e2)
    assert.deepEqual(e1, e2)
    nodeAssert.deepStrictEqual(e1, e2)

    expect(() => {
      throw e1
    }).toThrowError(e2)
  }

  {
    // same
    const e1 = new MyError('hi', 'a')
    const e2 = new MyError('hi', 'a')
    expect(e1).toEqual(e2)
    expect(e1).toStrictEqual(e2)
    assert.deepEqual(e1, e2)
    nodeAssert.deepStrictEqual(e1, e2)
  }

  {
    // different cause
    const e1 = new Error('hello', { cause: 'x' })
    const e2 = new Error('hello', { cause: 'y' })
    snapshotError(() => expect(e1).toEqual(e2))
    expect(e1).not.toEqual(e2)
  }

  {
    // different cause (asymmetric fail)
    const e1 = new Error('hello')
    const e2 = new Error('hello', { cause: 'y' })
    snapshotError(() => expect(e1).toEqual(e2))
    expect(e1).not.toEqual(e2)
  }

  {
    // different cause (asymmetric pass)
    const e1 = new Error('hello', { cause: 'x' })
    const e2 = new Error('hello')
    expect(e1).toEqual(e2)
  }

  {
    // different cause (fail by other props)
    const e1 = new Error('hello', { cause: 'x' })
    const e2 = new Error('world')
    snapshotError(() => expect(e1).toEqual(e2))
  }

  {
    // different cause
    const e1 = new Error('hello', { cause: 'x' })
    const e2 = { something: 'else' }
    snapshotError(() => expect(e1).toEqual(e2))
  }

  {
    // AggregateError (pass)
    const e1 = new AggregateError([new Error('inner')], 'outer', { cause: 'x' })
    const e2 = new AggregateError([new Error('inner')], 'outer', { cause: 'x' })
    expect(e1).toEqual(e2)
  }

  {
    // AggregateError (fail)
    const e1 = new AggregateError([new Error('inner', { cause: 'x' })], 'outer', { cause: 'x' })
    const e2 = new AggregateError([new Error('inner', { cause: 'y' })], 'outer', { cause: 'x' })
    snapshotError(() => expect(e1).toEqual(e2))
  }

  {
    // cyclic (pass)
    const e1 = new Error('hi')
    e1.cause = e1
    const e2 = new Error('hi')
    e2.cause = e2
    expect(e1).toEqual(e2)
  }

  {
    // cyclic (fail)
    const e1 = new Error('hello')
    e1.cause = e1
    const e2 = new Error('world')
    e2.cause = e2
    snapshotError(() => expect(e1).toEqual(e2))
  }

  {
    // asymmetric matcher
    const e1 = new Error('hello', { cause: 'x' })
    expect(e1).toEqual(expect.objectContaining({
      message: 'hello',
      cause: 'x',
    }))
    snapshotError(() => expect(e1).toEqual(expect.objectContaining({
      message: 'hello',
      cause: 'y',
    })))
    snapshotError(() => expect(e1).toEqual(expect.objectContaining({
      message: 'world',
      cause: 'x',
    })))
    snapshotError(() => expect(e1).toEqual(expect.objectContaining({
      message: 'world',
      cause: 'y',
    })))
  }
})

it('toHaveBeenNthCalledWith error', () => {
  const fn = vi.fn()
  fn('World')
  fn('Hi')
  snapshotError(() => expect(fn).toHaveBeenNthCalledWith(2, 'hey'))
  snapshotError(() => expect(fn).toHaveBeenNthCalledWith(3, 'hey'))
})

it('toMatch/toContain diff', () => {
  snapshotError(() => expect('hello'.repeat(20)).toContain('world'))
  snapshotError(() => expect('hello'.repeat(20)).toMatch('world'))
  snapshotError(() => expect('hello'.repeat(20)).toMatch(/world/))
})

it('timeout', () => new Promise(resolve => setTimeout(resolve, 500)))

it('diff', () => {
  snapshotError(() => expect(undefined).toBeTruthy())
  snapshotError(() => expect({ hello: 'world' }).toBeFalsy())
  snapshotError(() => expect({ hello: 'world' }).toBeNaN())
  snapshotError(() => expect({ hello: 'world' }).toBeUndefined())
  snapshotError(() => expect({ hello: 'world' }).toBeNull())
})

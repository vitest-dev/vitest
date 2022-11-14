/* eslint-disable no-sparse-arrays */
import { AssertionError } from 'assert'
import { describe, expect, it, vi } from 'vitest'
import { generateToBeMessage } from 'vitest/src/integrations/chai/jest-utils'

class TestError extends Error {}

// For expect.extend
interface CustomMatchers<R = unknown> {
  toBeDividedBy(divisor: number): R
}
declare global {
  namespace Vi {
    interface JestAssertion extends CustomMatchers {}
    interface AsymmetricMatchersContaining extends CustomMatchers {}
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
    expect([1, 2, 3]).toHaveLength(3)
    expect('abc').toHaveLength(3)
    expect('').not.toHaveLength(5)
    expect({ length: 3 }).toHaveLength(3)
    expect(0.2 + 0.1).not.toBe(0.3)
    expect(0.2 + 0.1).toBeCloseTo(0.3, 5)
    expect(0.2 + 0.1).not.toBeCloseTo(0.3, 100) // expect.closeTo will fail in chai
  })

  it('asymmetric matchers (jest style)', () => {
    expect({ foo: 'bar' }).toEqual({ foo: expect.stringContaining('ba') })
    expect('bar').toEqual(expect.stringContaining('ba'))
    expect(['bar']).toEqual([expect.stringContaining('ba')])
    expect(new Set(['bar'])).toEqual(new Set([expect.stringContaining('ba')]))

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

    // TODO: support set
    // expect(new Set(['bar'])).not.toEqual(new Set([expect.stringContaining('zoo')]))
  })

  it('asymmetric matchers negate', () => {
    expect('bar').toEqual(expect.not.stringContaining('zoo'))
    expect('bar').toEqual(expect.not.stringMatching(/zoo/))
    expect({ bar: 'zoo' }).toEqual(expect.not.objectContaining({ zoo: 'bar' }))
    expect(['Bob', 'Eve']).toEqual(expect.not.arrayContaining(['Steve']))
  })

  it('expect.extend', () => {
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
    })

    expect(5).toBeDividedBy(5)
    expect(5).not.toBeDividedBy(4)
    expect({ one: 1, two: 2 }).toEqual({
      one: expect.toBeDividedBy(1),
      two: expect.not.toBeDividedBy(5),
    })
  })

  it('object', () => {
    expect({}).toEqual({})
    expect({ apples: 13 }).toEqual({ apples: 13 })
    expect({}).toStrictEqual({})
    expect({}).not.toBe({})

    const foo = {}
    const complex = {
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
    expect(complex).toHaveProperty('foo')
    expect(complex).toHaveProperty('foo', 1)
    expect(complex).toHaveProperty('bar.foo', 'foo')
    expect(complex).toHaveProperty('bar.arr[0]')
    expect(complex).toHaveProperty('bar.arr[1].zoo', 'monkey')
    expect(complex).toHaveProperty('bar.arr.0')
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
    }).toThrowErrorMatchingInlineSnapshot('"expected { foo: 1, \'foo.bar[0]\': \'baz\', …(3) } to have property \\"a-b\\" with value false"')
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
})

describe('toBeTypeOf()', () => {
  it.each([
    [1n, 'bigint'],
    [true, 'boolean'],
    [false, 'boolean'],
    [() => {}, 'function'],
    [function () {}, 'function'],
    [1, 'number'],
    [Infinity, 'number'],
    [NaN, 'number'],
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

  it('resolves trows chai', async () => {
    const assertion = async () => {
      await expect((async () => new Error('msg'))()).resolves.toThrow()
    }

    await expect(assertion).rejects.toThrowError('expected promise to throw an error, but it didn\'t')
  })

  it('resolves trows jest', async () => {
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
    expect((async () => {
      throw new TestError('error')
    })()).rejects.toThrow(TestError)
    const err = new Error('hello world')
    expect((async () => {
      throw err
    })()).rejects.toThrow(err)
    expect((async () => {
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
    }
    catch (error) {
      expect(error).toEqual(expectedError)
    }

    try {
      expect(() => 1).rejects.toEqual(2)
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
    }
    catch (error) {
      expect(error).toEqual(toStrictEqualError1)
    }

    const toStrictEqualError2 = generatedToBeMessage('toStrictEqual', 'FakeClass{}', 'FakeClass{}')
    try {
      expect(new FakeClass()).toBe(new FakeClass())
    }
    catch (error) {
      expect(error).toEqual(toStrictEqualError2)
    }

    const toEqualError1 = generatedToBeMessage('toEqual', '{}', 'FakeClass{}')
    try {
      expect({}).toBe(new FakeClass())
    }
    catch (error) {
      expect(error).toEqual(toEqualError1)
      // expect(error).toEqual('1234')
    }

    const toEqualError2 = generatedToBeMessage('toEqual', 'FakeClass{}', '{}')
    try {
      expect(new FakeClass()).toBe({})
    }
    catch (error) {
      expect(error).toEqual(toEqualError2)
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

it('timeout', () => new Promise(resolve => setTimeout(resolve, 500)))

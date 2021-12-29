/* eslint-disable comma-spacing */
/* eslint-disable no-sparse-arrays */
import { describe, expect, it } from 'vitest'

describe('jest-expect', () => {
  it('basic', () => {
    expect(1).toBe(1)
    expect(null).toBeNull()
    expect(null).toBeDefined()
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
    expect(1).toBeGreaterThanOrEqual(1)
    expect(1).toBeGreaterThanOrEqual(0)
    expect(0).toBeLessThan(1)
    expect(1).toBeLessThanOrEqual(1)
    expect(0).toBeLessThanOrEqual(1)
    expect(() => {
      throw new Error('this is the error message')
    }).toThrow('this is the error message')
    expect(() => {}).not.toThrow()
    expect([1, 2, 3]).toHaveLength(3)
    expect('abc').toHaveLength(3)
    expect('').not.toHaveLength(5)
    expect({ length: 3 }).toHaveLength(3)
    expect(0.2 + 0.1).not.toBe(0.3)
    expect(0.2 + 0.1).toBeCloseTo(0.3, 5)
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

  it('asymmetric matchers (chai style)', () => {
    expect({ foo: 'bar' }).equal({ foo: expect.stringContaining('ba') })
    expect('bar').equal(expect.stringContaining('ba'))
    expect(['bar']).equal([expect.stringContaining('ba')])
    expect({ foo: 'bar', bar: 'foo', hi: 'hello' }).equal({
      foo: expect.stringContaining('ba'),
      bar: expect.stringContaining('fo'),
      hi: 'hello',
    })

    expect({ foo: 'bar' }).not.equal({ foo: expect.stringContaining('zoo') })
    expect('bar').not.equal(expect.stringContaining('zoo'))
    expect(['bar']).not.equal([expect.stringContaining('zoo')])
  })

  it('object', () => {
    expect({}).toEqual({})
    expect({}).toStrictEqual({})
    expect({}).not.toBe({})

    const foo = {}
    const complex = { foo: 1, bar: { foo: 'foo', bar: 100, arr: ['first', { zoo: 'monkey' }] } }

    expect(foo).toBe(foo)
    expect(foo).toStrictEqual(foo)
    expect(complex).toMatchObject({})
    expect(complex).toMatchObject({ foo: 1 })
    expect([complex]).toMatchObject([{ foo: 1 }])
    expect(complex).not.toMatchObject({ foo: 2 })
    expect(complex).toMatchObject({ bar: { bar: 100 } })

    expect(complex).toHaveProperty('foo')
    expect(complex).toHaveProperty('foo', 1)
    expect(complex).toHaveProperty('bar.foo', 'foo')
    expect(complex).toHaveProperty('bar.arr[0]')
    expect(complex).toHaveProperty('bar.arr[1].zoo', 'monkey')
    expect(complex).toHaveProperty('bar.arr.0')
    expect(complex).toHaveProperty('bar.arr.1.zoo', 'monkey')
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

  // https://jestjs.io/docs/expect#tostrictequalvalue

  class LaCroix {
    constructor(public flavor) {}
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

    const foo = []

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
    constructor(public a, public b) {}
  }

  class TestClassB {
    constructor(public a, public b) {}
  }

  const TestClassC = class Child extends TestClassA {
    constructor(a, b) {
      super(a, b)
    }
  }

  const TestClassD = class Child extends TestClassB {
    constructor(a, b) {
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

describe('async expect', () => {
  it('resolves', async() => {
    await expect((async() => 'true')()).resolves.toBe('true')
    await expect((async() => 'true')()).resolves.not.toBe('true22')
  })

  it.fails('failed to resolve', async() => {
    await expect((async() => {
      throw new Error('err')
    })()).resolves.toBe('true')
  })

  it('rejects', async() => {
    await expect((async() => {
      throw new Error('err')
    })()).rejects.toStrictEqual(new Error('err'))

    await expect((async() => {
      throw new Error('err')
    })()).rejects.not.toStrictEqual(new Error('fake err'))
  })

  it.fails('failed to reject', async() => {
    await expect((async() => 'test')()).rejects.toBe('test')
  })
})

it('timeout', () => new Promise(resolve => setTimeout(resolve, 500)))

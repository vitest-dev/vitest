import { describe, it, expect } from 'vitest'

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

  it('object', () => {
    expect({}).toEqual({})
    expect({}).not.toBe({})
    expect({}).not.toStrictEqual({})

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
})

it('timeout', () => new Promise(resolve => setTimeout(resolve, 500)))

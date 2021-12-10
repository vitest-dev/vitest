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
    expect(() => {
      throw new Error('error')
    }).toThrow()
    expect(() => {}).not.toThrow()
  })

  it('object', () => {
    expect({}).toEqual({})
    expect({}).not.toBe({})
    expect({}).not.toStrictEqual({})

    const foo = {}
    const complex = { foo: 1, bar: { foo: 'foo', bar: 100 } }

    expect(foo).toBe(foo)
    expect(foo).toStrictEqual(foo)
    expect(complex).toMatchObject({})
    expect(complex).toMatchObject({ foo: 1 })
    expect([complex]).toMatchObject([{ foo: 1 }])
    expect(complex).not.toMatchObject({ foo: 2 })
    expect(complex).toMatchObject({ bar: { bar: 100 } })
  })
})

it('timeout', () => new Promise(resolve => setTimeout(resolve, 500)))

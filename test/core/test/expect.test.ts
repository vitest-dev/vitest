import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Tester } from '@vitest/expect'
import { stripVTControlCharacters } from 'node:util'
import { getCurrentTest } from '@vitest/runner'
import { processError } from '@vitest/utils/error'
import { Temporal } from 'temporal-polyfill'
import { describe, expect, expectTypeOf, test, vi } from 'vitest'

describe('expect.soft', () => {
  test('types', () => {
    expectTypeOf(expect.soft(7)).toEqualTypeOf(expect(7))
    expectTypeOf(expect.soft(5)).toHaveProperty('toBe')
    expectTypeOf(expect.soft(7)).not.toHaveProperty('toCustom')
  })

  test('return value', () => {
    expect(expect.soft('test')).toHaveProperty('toBe')
    expect(expect.soft('test')).toHaveProperty('toEqual')
  })

  test('with extend', () => {
    expect.extend({
      toBeFoo(received) {
        const { isNot } = this
        return {
          // do not alter your "pass" based on isNot. Vitest does it for you
          pass: received === 'foo',
          message: () => `${received} is${isNot ? ' not' : ''} foo`,
        }
      },
    })
    expect(expect.soft('test')).toHaveProperty('toBeFoo')
  })

  test('should have multiple error', () => {
    expect.soft(1).toBe(2)
    expect.soft(2).toBe(3)
    getCurrentTest()!.result!.state = 'run'
    expect(getCurrentTest()?.result?.errors).toHaveLength(2)
  })

  test.fails('should be a failure', () => {
    expect.soft('test1').toBe('test res')
    expect.soft('test2').toBe('test res')
    expect.soft('test3').toBe('test res')
  })
})

describe('expect.addEqualityTesters', () => {
  class AnagramComparator {
    public word: string

    constructor(word: string) {
      this.word = word
    }

    equals(other: AnagramComparator): boolean {
      const cleanStr1 = this.word.replace(/ /g, '').toLowerCase()
      const cleanStr2 = other.word.replace(/ /g, '').toLowerCase()

      const sortedStr1 = cleanStr1.split('').sort().join('')
      const sortedStr2 = cleanStr2.split('').sort().join('')

      return sortedStr1 === sortedStr2
    }
  }

  function createAnagramComparator(word: string) {
    return new AnagramComparator(word)
  }

  function isAnagramComparator(a: unknown): a is AnagramComparator {
    return a instanceof AnagramComparator
  }

  const areObjectsEqual: Tester = (
    a: unknown,
    b: unknown,
  ): boolean | undefined => {
    const isAAnagramComparator = isAnagramComparator(a)
    const isBAnagramComparator = isAnagramComparator(b)

    if (isAAnagramComparator && isBAnagramComparator) {
      return a.equals(b)
    }

    else if (isAAnagramComparator === isBAnagramComparator) {
      return undefined
    }

    else {
      return false
    }
  }

  function* toIterator<T>(array: Array<T>): Iterator<T> {
    for (const obj of array) {
      yield obj
    }
  }

  const customObject1 = createAnagramComparator('listen')
  const customObject2 = createAnagramComparator('silent')

  expect.addEqualityTesters([areObjectsEqual])

  test('AnagramComparator objects are unique and not contained within arrays of AnagramComparator objects', () => {
    expect(customObject1).not.toBe(customObject2)
    expect([customObject1]).not.toContain(customObject2)
  })

  test('basic matchers pass different AnagramComparator objects', () => {
    expect(customObject1).toEqual(customObject2)
    expect([customObject1, customObject2]).toEqual([customObject2, customObject1])
    expect(new Map([['key', customObject1]])).toEqual(new Map([['key', customObject2]]))
    expect(new Set([customObject1])).toEqual(new Set([customObject2]))
    expect(toIterator([customObject1, customObject2])).toEqual(
      toIterator([customObject2, customObject1]),
    )
    expect([customObject1]).toContainEqual(customObject2)
    expect({ a: customObject1 }).toHaveProperty('a', customObject2)
    expect({ a: customObject2, b: undefined }).toStrictEqual({
      a: customObject1,
      b: undefined,
    })
    expect({ a: 1, b: { c: customObject1 } }).toMatchObject({
      a: 1,
      b: { c: customObject2 },
    })
  })

  test('asymmetric matchers pass different AnagramComparator objects', () => {
    expect([customObject1]).toEqual(expect.arrayContaining([customObject1]))
    expect({ a: 1, b: { c: customObject1 } }).toEqual(
      expect.objectContaining({ b: { c: customObject2 } }),
    )
  })

  test('toBe recommends toStrictEqual even with different objects', () => {
    expect(() => expect(customObject1).toBe(customObject2)).toThrow('toStrictEqual')
  })

  test('toBe recommends toEqual even with different AnagramComparator objects', () => {
    expect(() => expect({ a: undefined, b: customObject1 }).toBe({ b: customObject2 })).toThrow(
      'toEqual',
    )
  })

  test('iterableEquality still properly detects cycles', () => {
    const a = new Set()
    a.add(customObject1)
    a.add(a)

    const b = new Set()
    b.add(customObject2)
    b.add(b)

    expect(a).toEqual(b)
  })
})

describe('recursive custom equality tester for numeric values', () => {
  const areNumbersEqual: Tester = (a, b) => typeof b === 'number' ? a === b : undefined

  expect.addEqualityTesters([areNumbersEqual])

  test('within objects', () => {
    expect({ foo: -0, bar: 0, baz: 0 }).toStrictEqual({ foo: 0, bar: -0, baz: 0 })
  })

  test('within arrays', () => {
    expect([-0, 0, 0]).toStrictEqual([0, -0, 0])
  })

  test('within typed arrays', () => {
    expect(Float64Array.of(-0, 0, 0)).toStrictEqual(Float64Array.of(0, -0, 0))
  })

  test('within deeply nested structures', () => {
    expect({ foo: { bar: [1, [2, 0, [3, -0, 4]]] }, baz: 0 }).toStrictEqual({ foo: { bar: [1, [2, -0, [3, 0, 4]]] }, baz: -0 })
  })
})

describe('recursive custom equality tester', () => {
  let personId = 0

  class Address {
    public address: string

    constructor(address: string) {
      this.address = address
    }
  }
  class Person {
    public name: string
    public address: Address
    public personId: string

    constructor(name: string, address: Address) {
      this.name = name
      this.address = address
      this.personId = `${personId++}`
    }
  }

  const arePersonsEqual: Tester = function (a, b, customTesters) {
    const isAPerson = a instanceof Person
    const isBPerson = b instanceof Person

    if (isAPerson && isBPerson) {
      return a.name === b.name && this.equals(a.address, b.address, customTesters)
    }

    else if (isAPerson === isBPerson) {
      return undefined
    }

    else {
      return false
    }
  }

  const areAddressesEqual: Tester = (a, b) => {
    const isAAddress = a instanceof Address
    const isBAddress = b instanceof Address

    if (isAAddress && isBAddress) {
      return a.address === b.address
    }

    else if (isAAddress === isBAddress) {
      return undefined
    }

    else { return false }
  }

  const person1 = new Person('Luke Skywalker', new Address('Tatooine'))
  const person2 = new Person('Luke Skywalker', new Address('Tatooine'))

  expect.addEqualityTesters([areAddressesEqual, arePersonsEqual])

  test('basic matchers pass different Address objects', () => {
    expect(person1).not.toBe(person2)
    expect([person1]).not.toContain(person2)
    expect(person1).toEqual(person1)
    expect(person1).toEqual(person2)
    expect([person1, person2]).toEqual([person2, person1])
    expect(new Map([['key', person1]])).toEqual(new Map([['key', person2]]))
    expect(new Set([person1])).toEqual(new Set([person2]))
    expect([person1]).toContainEqual(person2)
    expect({ a: person1 }).toHaveProperty('a', person2)
    expect({ a: person1, b: undefined }).toStrictEqual({
      a: person2,
      b: undefined,
    })
    expect({ a: 1, b: { c: person1 } }).toMatchObject({
      a: 1,
      b: { c: person2 },
    })
  })

  test('asymmetric matchers pass different Address objects', () => {
    expect([person1]).toEqual(expect.arrayContaining([person2]))
    expect({ a: 1, b: { c: person1 } }).toEqual(
      expect.objectContaining({ b: { c: person2 } }),
    )
  })

  test('toBe recommends toStrictEqual even with different Address objects', () => {
    expect(() => expect(person1).toBe(person2)).toThrow('toStrictEqual')
  })

  test('toBe recommends toEqual even with different Address objects', () => {
    expect(() => expect({ a: undefined, b: person1 }).toBe({ b: person2 })).toThrow(
      'toEqual',
    )
  })

  test('iterableEquality still properly detects cycles', () => {
    const a = new Set()
    a.add(person1)
    a.add(a)

    const b = new Set()
    b.add(person2)
    b.add(b)

    expect(a).toEqual(b)
  })

  test('spy matchers pass different Person objects', () => {
    const mockFn = vi.fn(
      (person: Person) => [person, person2],
    )
    mockFn(person1)

    expect(mockFn).toHaveBeenCalledWith(person1)
    expect(mockFn).toHaveBeenCalledWith(person1)
    expect(mockFn).toHaveBeenLastCalledWith(person1)
    expect(mockFn).toHaveBeenNthCalledWith(1, person1)

    expect(mockFn).toHaveReturnedWith([person1, person2])
    expect(mockFn).toHaveLastReturnedWith([person1, person2])
    expect(mockFn).to.have.lastReturnedWith([person1, person2])
    expect(mockFn).toHaveNthReturnedWith(1, [person1, person2])
  })
})

describe('iterator', () => {
  test('returns true when given iterator within equal objects', () => {
    const a = {
      [Symbol.iterator]: () => ({ next: () => ({ done: true }) }),
      a: [],
    }
    const b = {
      [Symbol.iterator]: () => ({ next: () => ({ done: true }) }),
      a: [],
    }

    expect(a).toStrictEqual(b)
  })

  test('returns false when given iterator within inequal objects', () => {
    const a = {
      [Symbol.iterator]: () => ({ next: () => ({ done: true }) }),
      a: [1],
    }
    const b = {
      [Symbol.iterator]: () => ({ next: () => ({ done: true }) }),
      a: [],
    }

    expect(a).not.toStrictEqual(b)
  })

  test('returns false when given iterator within inequal nested objects', () => {
    const a = {
      [Symbol.iterator]: () => ({ next: () => ({ done: true }) }),
      a: {
        b: [1],
      },
    }
    const b = {
      [Symbol.iterator]: () => ({ next: () => ({ done: true }) }),
      a: {
        b: [],
      },
    }

    expect(a).not.toStrictEqual(b)
  })
})

describe('Temporal equality', () => {
  describe.each([
    ['Instant', ['2025-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z']],
    ['ZonedDateTime', ['2025-01-01T00:00:00+01:00[Europe/Amsterdam]', '2025-01-01T00:00:00+01:00[Europe/Paris]']],
    ['PlainDateTime', ['2025-01-01T00:00:00.000', '2026-01-01T00:00:00.000']],
    ['PlainDate', ['2025-01-01', '2026-01-01']],
    ['PlainTime', ['15:00:00.000', '16:00:00.000']],
    ['PlainYearMonth', ['2025-01', '2026-01']],
    ['PlainMonthDay', ['01-01', '02-01']],
  ] as const)('of $className', (className, [first, second]) => {
    test('returns true when equal', () => {
      const a = Temporal[className].from(first)
      const b = Temporal[className].from(first)

      expect(a).toStrictEqual(b)
    })

    test('returns false when not equal', () => {
      const a = Temporal[className].from(first)
      const b = Temporal[className].from(second)

      expect(a).not.toStrictEqual(b)
    })
  })

  describe('of Duration', () => {
    test('returns true when .toString() is equal', () => {
      const a = Temporal.Duration.from('P1M')
      const b = Temporal.Duration.from('P1M')

      expect(a).toStrictEqual(b)
    })

    test('returns true when .toString() is not equal', () => {
      const a = Temporal.Duration.from('PT1M')
      const b = Temporal.Duration.from('PT60S')

      expect(a).not.toStrictEqual(b)
    })
  })
})

describe('expect with custom message', () => {
  describe('built-in matchers', () => {
    test('sync matcher throws custom message on failure', () => {
      expect(() => expect(1, 'custom message').toBe(2)).toThrow('custom message')
    })

    test('async rejects matcher throws custom message on failure', async ({ expect }) => {
      const asyncAssertion = expect(Promise.reject(new Error('test error')), 'custom async message').rejects.toBe(2)
      await expect(asyncAssertion).rejects.toThrow('custom async message')
    })

    test('async resolves matcher throws custom message on failure', async ({ expect }) => {
      const asyncAssertion = expect(Promise.resolve(1), 'custom async message').resolves.toBe(2)
      await expect(asyncAssertion).rejects.toThrow('custom async message')
    })

    test('not matcher throws custom message on failure', () => {
      expect(() => expect(1, 'custom message').not.toBe(1)).toThrow('custom message')
    })
  })

  describe('custom matchers with expect.extend', () => {
    test('sync custom matcher throws custom message on failure', ({ expect }) => {
      expect.extend({
        toBeFoo(actual) {
          const { isNot } = this
          return {
            pass: actual === 'foo',
            message: () => `${actual} is${isNot ? ' not' : ''} foo`,
          }
        },
      })
      expect(() => (expect('bar', 'custom message') as any).toBeFoo()).toThrow('custom message')
    })

    test('sync custom matcher passes with custom message when assertion succeeds', ({ expect }) => {
      expect.extend({
        toBeFoo(actual) {
          const { isNot } = this
          return {
            pass: actual === 'foo',
            message: () => `${actual} is${isNot ? ' not' : ''} foo`,
          }
        },
      })
      expect(() => (expect('foo', 'custom message') as any).toBeFoo()).not.toThrow()
    })

    test('async custom matcher throws custom message on failure', async ({ expect }) => {
      expect.extend({
        async toBeFoo(actual) {
          const resolvedValue = await actual
          return {
            pass: resolvedValue === 'foo',
            message: () => `${resolvedValue} is not foo`,
          }
        },
      })
      const asyncAssertion = (expect(Promise.resolve('bar'), 'custom async message') as any).toBeFoo()
      await expect(asyncAssertion).rejects.toThrow('custom async message')
    })

    test('async custom matcher with not throws custom message on failure', async ({ expect }) => {
      expect.extend({
        async toBeFoo(actual) {
          const resolvedValue = await actual
          return {
            pass: resolvedValue === 'foo',
            message: () => `${resolvedValue} is not foo`,
          }
        },
      })
      const asyncAssertion = (expect(Promise.resolve('foo'), 'custom async message') as any).not.toBeFoo()
      await expect(asyncAssertion).rejects.toThrow('custom async message')
    })
  })

  describe('edge cases', () => {
    test('empty custom message falls back to default matcher message', () => {
      expect(() => expect(1, '').toBe(2)).toThrow('expected 1 to be 2 // Object.is equality')
    })

    test('undefined custom message falls back to default matcher message', () => {
      expect(() => expect(1, undefined as any).toBe(2)).toThrow('expected 1 to be 2 // Object.is equality')
    })
  })
})

describe('Standard Schema', () => {
  function createMockSchema(validate: StandardSchemaV1['~standard']['validate']): StandardSchemaV1 {
    return {
      '~standard': {
        version: 1,
        vendor: 'mock',
        validate,
      },
    }
  }

  function createAsyncMockSchema(validate: StandardSchemaV1['~standard']['validate']): StandardSchemaV1 {
    return {
      '~standard': {
        version: 1,
        vendor: 'mock-async',
        validate: value => Promise.resolve(validate(value)),
      },
    }
  }

  const stringSchema = createMockSchema(value =>
    typeof value === 'string' ? { issues: undefined, value } : { issues: [{ message: 'Expected string' }] },
  )
  const numberSchema = createMockSchema(value =>
    typeof value === 'number' ? { issues: undefined, value } : { issues: [{ message: 'Expected number' }] },
  )
  const emailSchema = createMockSchema(value =>
    typeof value === 'string' && /^[\w%+.-]+@[\d.A-Z-]+\.[A-Z]{2,}$/i.test(value) ? { issues: undefined, value } : { issues: [{ message: 'Expected email' }] },
  )
  const objectSchema = createMockSchema(value =>
    typeof value === 'object' && value !== null && 'name' in value && 'age' in value && typeof value.name === 'string' && typeof value.age === 'number' ? { issues: undefined, value } : { issues: [{ message: 'Expected object' }] },
  )
  const asyncStringSchema = createAsyncMockSchema(value =>
    typeof value === 'string' ? { issues: undefined, value } : { issues: [{ message: 'Expected string' }] },
  )

  describe('schemaMatching()', () => {
    test('should work with primitive values', () => {
      expect('hello').toEqual(expect.schemaMatching(stringSchema))
      expect(42).toEqual(expect.schemaMatching(numberSchema))

      expect(() => expect(123).toEqual(expect.schemaMatching(stringSchema))).toThrowErrorMatchingInlineSnapshot(`[AssertionError: expected 123 to deeply equal SchemaMatching{…}]`)
      expect(() => expect('hello').toEqual(expect.schemaMatching(numberSchema))).toThrowErrorMatchingInlineSnapshot(`[AssertionError: expected 'hello' to deeply equal SchemaMatching{…}]`)

      try {
        expect(123).toEqual(expect.schemaMatching(stringSchema))
        expect.unreachable()
      }
      catch (err) {
        const error = processError(err)
        const diff = stripVTControlCharacters(error.diff!)
        expect(diff).toMatchInlineSnapshot(`
          "- Expected:
          SchemaMatching {
            "issues": [
              {
                "message": "Expected string",
              },
            ],
          }

          + Received:
          123"
        `)
      }
    })

    test('should work with objects', () => {
      expect({
        email: 'john@example.com',
      }).toEqual({
        email: expect.schemaMatching(emailSchema),
      })

      expect(() => expect({
        email: 123,
      }).toEqual({
        email: expect.schemaMatching(emailSchema),
      })).toThrowErrorMatchingInlineSnapshot(`[AssertionError: expected { email: 123 } to deeply equal { email: SchemaMatching{…} }]`)

      try {
        expect({
          email: 'not-an-email',
        }).toEqual({
          email: expect.schemaMatching(emailSchema),
        })
        expect.unreachable()
      }
      catch (err) {
        const error = processError(err)
        const diff = stripVTControlCharacters(error.diff!)
        expect(diff).toMatchInlineSnapshot(`
          "- Expected
          + Received

            {
          -   "email": SchemaMatching {
          -   "issues": [
          -     {
          -       "message": "Expected email",
          -     },
          -   ],
          - },
          +   "email": "not-an-email",
            }"
        `)
      }
    })

    test('should work with objectContaining', () => {
      expect({
        name: 'John',
        age: 30,
      }).toEqual(expect.objectContaining({
        age: expect.schemaMatching(numberSchema),
      }))

      try {
        expect({
          user: {
            name: 'John',
            age: 'thirty',
          },
        }).toEqual({
          user: {
            name: expect.schemaMatching(stringSchema),
            age: expect.schemaMatching(numberSchema),
          },
        })
        expect.unreachable()
      }
      catch (err) {
        const error = processError(err)
        const diff = stripVTControlCharacters(error.diff!)
        expect(diff).toMatchInlineSnapshot(`
          "- Expected
          + Received

            {
              "user": {
          -     "age": SchemaMatching {
          -   "issues": [
          -     {
          -       "message": "Expected number",
          -     },
          -   ],
          - },
          +     "age": "thirty",
                "name": "John",
              },
            }"
        `)
      }
    })

    test('should work with arrayContaining', () => {
      expect([{
        name: 'John',
        age: 30,
      }]).toEqual(expect.arrayContaining([expect.schemaMatching(objectSchema)]))

      try {
        expect([{
          name: 'John',
          age: 'thirty',
        }]).toEqual(expect.arrayContaining([expect.schemaMatching(objectSchema)]))
        expect.unreachable()
      }
      catch (err) {
        const error = processError(err)
        const diff = stripVTControlCharacters(error.diff!)
        expect(diff).toContain('SchemaMatching')
        expect(diff).toContain('ArrayContaining')
      }
    })

    test('should work with negation', () => {
      expect(123).not.toEqual(expect.schemaMatching(stringSchema))
      expect('hello').not.toEqual(expect.schemaMatching(numberSchema))

      expect(() => expect('hello').not.toEqual(expect.schemaMatching(stringSchema))).toThrowErrorMatchingInlineSnapshot(`[AssertionError: expected 'hello' to not deeply equal SchemaMatching]`)

      try {
        expect('hello').not.toEqual(expect.schemaMatching(stringSchema))
        expect.unreachable()
      }
      catch (err) {
        const error = processError(err)
        const diff = stripVTControlCharacters(error.diff!)
        expect(diff).toMatchInlineSnapshot(`
          "- Expected:
          SchemaMatching

          + Received:
          "hello""
        `)
      }
    })

    test('should throw error for async schemas', () => {
      expect(() => expect('hello').toEqual(expect.schemaMatching(asyncStringSchema))).toThrowErrorMatchingInlineSnapshot(`[TypeError: Async schema validation is not supported in asymmetric matchers.]`)
    })

    test('should throw error for non-schema argument', () => {
      expect(() => expect.schemaMatching('not-a-schema')).toThrowErrorMatchingInlineSnapshot(`[TypeError: SchemaMatching expected to receive a Standard Schema.]`)
    })

    test('should work with toMatchObject', () => {
      const data = {
        user: {
          name: 'John',
          age: 30,
        },
        extra: 'data',
      }

      expect(data).toMatchObject({
        user: {
          name: expect.schemaMatching(stringSchema),
          age: expect.schemaMatching(numberSchema),
        },
      })

      try {
        expect({
          user: {
            name: 123,
            age: 30,
          },
        }).toMatchObject({
          user: {
            name: expect.schemaMatching(stringSchema),
          },
        })
        expect.unreachable()
      }
      catch (err) {
        const error = processError(err)
        const diff = stripVTControlCharacters(error.diff!)
        expect(diff).toMatchInlineSnapshot(`
          "- Expected
          + Received

            {
              "user": {
          -     "name": SchemaMatching {
          -   "issues": [
          -     {
          -       "message": "Expected string",
          -     },
          -   ],
          - },
          +     "name": 123,
              },
            }"
        `)
      }

      try {
        expect({
          name: 123,
          email: 'invalid',
          age: 'thirty',
        }).toEqual({
          name: expect.schemaMatching(stringSchema),
          email: expect.schemaMatching(emailSchema),
          age: expect.schemaMatching(numberSchema),
        })
        expect.unreachable()
      }
      catch (err) {
        const error = processError(err)
        const diff = stripVTControlCharacters(error.diff!)
        expect(diff).toMatchInlineSnapshot(`
          "- Expected
          + Received

            {
          -   "age": SchemaMatching {
          -   "issues": [
          -     {
          -       "message": "Expected number",
          -     },
          -   ],
          - },
          -   "email": SchemaMatching {
          -   "issues": [
          -     {
          -       "message": "Expected email",
          -     },
          -   ],
          - },
          -   "name": SchemaMatching {
          -   "issues": [
          -     {
          -       "message": "Expected string",
          -     },
          -   ],
          - },
          +   "age": "thirty",
          +   "email": "invalid",
          +   "name": 123,
            }"
        `)
      }
    })

    test('function', () => {
      const stringSchemaFn = Object.assign(() => {}, stringSchema)
      expect('hello').toEqual(expect.schemaMatching(stringSchemaFn))
    })
  })
})

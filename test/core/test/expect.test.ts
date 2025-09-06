import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Tester } from '@vitest/expect'
import { getCurrentTest } from '@vitest/runner'
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

  const objectSchema = createMockSchema(value =>
    typeof value === 'object' && value !== null && 'name' in value && 'age' in value && typeof value.name === 'string' && typeof value.age === 'number' ? { issues: undefined, value } : { issues: [{ message: 'Expected object' }] },
  )

  const asyncStringSchema = createAsyncMockSchema(value =>
    typeof value === 'string' ? { issues: undefined, value } : { issues: [{ message: 'Expected string' }] },
  )

  describe('toEqual(schema)', () => {
    test('should validate data against schema', () => {
      expect('hello').toEqual(stringSchema)
      expect('42').toEqual(numberSchema)

      expect({
        name: 'John',
        age: 30,
      }).toEqual({
        name: stringSchema,
        age: numberSchema,
      })
      expect({
        name: 'John',
        age: 30,
      }).toEqual(objectSchema)

      expect(() => expect(123).toEqual(stringSchema)).toThrow()
    })

    test('should validate data against schema in asymmetric matchers', () => {
      expect({
        name: 'John',
        age: '30',
      }).toEqual(expect.objectContaining({
        age: numberSchema,
      }))
      expect([{
        name: 'John',
        age: 30,
      }]).toEqual(expect.arrayContaining([objectSchema]))
    })

    test('should work with negation', () => {
      expect(123).not.toEqual(stringSchema)
      expect(() => expect('hello').not.toEqual(stringSchema)).toThrow()
    })

    test('should throw error for async schemas', () => {
      expect(() => expect('hello').toEqual(asyncStringSchema)).toThrow('Async schema validation is not supported')
    })
  })

  describe('toEqualSchema(schema)', () => {
    test('should validate data against schema', () => {
      expect('hello').toEqualSchema(stringSchema)
      expect('42').toEqualSchema(numberSchema)

      expect(() => expect(123).toEqualSchema(stringSchema)).toThrow()
      expect(() => expect('hello').toEqualSchema(numberSchema)).toThrow()
    })

    test('should validate data against schema in asymmetric matchers', () => {
      expect({
        name: 'John',
        age: '30',
      }).toEqual(expect.objectContaining({
        age: expect.toEqualSchema(numberSchema),
      }))
      expect([{
        name: 'John',
        age: 30,
      }]).toEqual(expect.arrayContaining([expect.toEqualSchema(objectSchema)]))
    })

    test('should work with negation', () => {
      expect(123).not.toEqualSchema(stringSchema)
      expect('hello').not.toEqualSchema(numberSchema)

      expect(() => expect('hello').not.toEqualSchema(stringSchema)).toThrow()
    })

    test('should throw error for async schemas', () => {
      expect(() => expect('hello').toEqual(asyncStringSchema)).toThrow('Async schema validation is not supported')
    })

    test('should throw error for non-schema argument', () => {
      expect(() => expect('hello').toEqualSchema('not-a-schema')).toThrow()
    })
  })

  describe('schemaMatching()', () => {
    test('should validate data against schema', () => {
      expect('hello').toEqual(expect.schemaMatching(stringSchema))
      expect('42').toEqual(expect.schemaMatching(numberSchema))

      expect(() => expect(123).toEqual(expect.schemaMatching(stringSchema))).toThrow()
      expect(() => expect('hello').toEqual(expect.schemaMatching(numberSchema))).toThrow()
    })

    test('should work with objectContaining', () => {
      expect({
        name: 'John',
        age: '30',
      }).toEqual(expect.objectContaining({
        age: expect.schemaMatching(numberSchema),
      }))
    })

    test('should work with arrayContaining', () => {
      expect([{
        name: 'John',
        age: 30,
      }]).toEqual(expect.arrayContaining([expect.schemaMatching(objectSchema)]))
    })

    test('should work with negation', () => {
      expect(123).not.toEqual(expect.schemaMatching(stringSchema))
      expect('hello').not.toEqual(expect.schemaMatching(numberSchema))

      expect(() => expect('hello').not.toEqual(expect.schemaMatching(stringSchema))).toThrow()
    })

    test('should throw error for async schemas', () => {
      expect(() => expect('hello').toEqual(expect.schemaMatching(asyncStringSchema))).toThrow('Async schema validation is not supported')
    })

    test('should throw error for non-schema argument', () => {
      expect(() => expect.schemaMatching('not-a-schema')).toThrow('SchemaMatching expected to receive a Standard Schema')
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
    })
  })
})

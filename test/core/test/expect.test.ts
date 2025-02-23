import type { Tester } from '@vitest/expect'
import { getCurrentTest } from '@vitest/runner'
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

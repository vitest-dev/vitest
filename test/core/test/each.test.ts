import { afterAll, describe, expect, test } from 'vitest'

test.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])('add(%i, %i) -> %i', (a, b, expected) => {
  expect(a + b).toBe(expected)
})

test.each([
  ['string', true],
  ['string', false],
])('can be parsed', (a, b) => {
  const typedA: string = a
  const typedB: boolean = b

  expect(typedA).toBeDefined()
  expect(typedB).toBeDefined()
})

describe.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])('describe add(%i, %i)', (a, b, expected) => {
  test(`returns ${expected}`, () => {
    expect(a + b).toBe(expected)
  })

  test(`returned value not be greater than ${expected}`, () => {
    expect(a + b).not.toBeGreaterThan(expected)
  })

  test(`returned value not be less than ${expected}`, () => {
    expect(a + b).not.toBeLessThan(expected)
  })
})

describe.each([
  [1, 'a', '1a'],
  [1, 'b', '1b'],
  [2, 'c', '2c'],
] as const)('describe concatenate(%i, %s)', (a, b, expected) => {
  test(`returns ${expected}`, () => {
    // This will fail typechecking if const is not used and/or types for a,b are merged into a union
    const typedA: number = a
    const typedB: string = b

    expect(`${typedA}${typedB}`).toBe(expected)
  })
})

describe.each([
  { a: 1, b: 1, expected: 2 },
  { a: 1, b: 2, expected: 3 },
  { a: 2, b: 1, expected: 3 },
])('describe object add($a, $b)', ({ a, b, expected }) => {
  test(`returns ${expected}`, () => {
    expect(a + b).toBe(expected)
  })

  test(`returned value not be greater than ${expected}`, () => {
    expect(a + b).not.toBeGreaterThan(expected)
  })

  test(`returned value not be less than ${expected}`, () => {
    expect(a + b).not.toBeLessThan(expected)
  })
})

// issue #794
describe.each([1, 2, 0])('%s (describe.each 1d)', (num) => {
  test(`${num} is a number (describe.each 1d)`, () => {
    expect(typeof num).toEqual('number')
  })
})

test.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])('the index of the test case is %#', (a, b, expected) => {
  expect(a + b).toBe(expected)
})

test.each([
  [1, 2, 3],
  [4, 5, 9],
])('return a promise like result %#', async (a, b, expected) => {
  const promiseResolver = (first: number, second: number) => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(first + second), 1)
    })
  }

  const result = await promiseResolver(a, b)
  expect(result).toBe(expected)
})

describe('context on test and describe - todo/skip', () => {
  let count = 0

  describe.todo.each([1])('todo describe', () => {
    test('this is todo test', () => {
      count++
    })
  })

  describe.skip.each([1])('todo describe', () => {
    test('this is todo test', () => {
      count++
    })
  })

  test.skip.each([1])('todo test', () => {
    count++
  })

  afterAll(() => {
    expect(count).toBe(0)
  })
})

describe('context with each - concurrent', () => {
  describe.concurrent.each([[1, 1, 2], [1, 2, 3], [1, 3, 4]])('block', (number1, number2, number3) => {
    test('numbered test', ({ expect }) => {
      expect(number1 + number2).toBe(number3)
    })
  })
})

describe('not all arguments are array describe.each', () => {
  const results = [null, [null]]
  let i = 0

  describe.each([null, [null]])('null is null', (value) => {
    test('null is null', () => {
      expect(value).toEqual(results[i++])
    })
  })
})

describe('not all arguments are array test.each', () => {
  const results = [
    null,
    [null],
  ]
  let i = 0

  test.each([
    null,
    [null],
  ])('matches results', (value) => {
    expect(value).toEqual(results[i++])
  })
})

test.each([
  null,
])('value is null', (value) => {
  expect(value).toBeNull()
})

test.each([
  [null, null],
  [null, null],
])('if all cases are arrays of equal length, treats array elements as arguments', (value1, value2) => {
  expect(value1).toBeNull()
  expect(value2).toBeNull()
})

describe.each`
a             | b      | expected
${1}          | ${1}   | ${2}
${'a'}        | ${'b'} | ${'ab'}
${[]}         | ${'b'} | ${'b'}
${{}}         | ${'b'} | ${'[object Object]b'}
${{ asd: 1 }} | ${'b'} | ${'[object Object]b'}
`('describe template string add($a, $b)', ({ a, b, expected }) => {
  test(`returns ${expected}`, () => {
    expect(a + b).toBe(expected)
  })
})

test.each`
a               | b      | expected
${1}            | ${1}   | ${2}
${'a'}          | ${'b'} | ${'ab'}
${[]}           | ${'b'} | ${'b'}
${{}}           | ${'b'} | ${'[object Object]b'}
${{ asd: 1 }}   | ${'b'} | ${'[object Object]b'}
`('returns $expected when $a is added $b', ({ a, b, expected }) => {
  expect(a + b).toBe(expected)
})

test.each`
a               | b      | expected
${{ val: 1 }}   | ${'b'} | ${'1b'}
${{ val: 2 }}   | ${'b'} | ${'2b'}
${{ val: 3 }}   | ${'b'} | ${'3b'}
`('returns $expected when $a.val is added $b', ({ a, b, expected }) => {
  expect(a.val + b).toBe(expected)
})

test.each`
a       | b       | expected
${true} | ${true} | ${true}
`('($a && $b) -> $expected', ({ a, b, expected }) => {
  expect(a && b).toBe(expected)
})

test.each`
a             | b              | expected
${{ val: 1 }} | ${{ val: 2 }}} | ${3}
`('($a && $b) -> $expected', ({ a, b, expected }) => {
  expect(a.val + b.val).toBe(expected)
})

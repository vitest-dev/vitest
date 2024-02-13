import { expect, expectTypeOf, test } from 'vitest'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const myTest = test.extend<{ myFixture: number }>({
  myFixture: async ({}, use) => {
    await use(1234)
  },
})

myTest.concurrent.each(['hello', 'hi'])(
  'single context false %s',
  (...args) => {
    args satisfies [string]
    expect(args[0]).toBeTypeOf('string')
  },
)

myTest.concurrent.each(['hello', 'hi'])(
  'single context true %s',
  async (arg, { expect, myFixture }) => {
    arg satisfies string
    await sleep(50)
    expect({ arg, myFixture }).toMatchSnapshot()
  },
  { context: true },
)

myTest.concurrent.each([['hello'], ['hi']])(
  'array 1 context false %s',
  (...args) => {
    args satisfies [string]
    expect(args[0]).toBeTypeOf('string')
  },
)

myTest.concurrent.each([['hello'], ['hi']])(
  'array 1 context true %s',
  async (arg, { expect, myFixture }) => {
    await sleep(50)
    expect({ arg, myFixture }).toMatchSnapshot()
  },
  { context: true },
)

myTest.concurrent.each([['hello', 2], ['hi', 3]])(
  'array 2 context false %s %s',
  (...args) => {
    args satisfies [string, number]
    expect(args[0]).toBeTypeOf('string')
    expect(args[1]).toBeTypeOf('number')
  },
)

myTest.concurrent.each([['hello', 2], ['hi', 3]])(
  'array 2 context true %s %s',
  async (argString, argNumber, { expect, myFixture }) => {
    argString satisfies string
    argNumber satisfies number
    await sleep(50)
    expect({ argString, argNumber, myFixture }).toMatchSnapshot()
    expect(argString).toBeTypeOf('string')
    expect(argNumber).toBeTypeOf('number')
  },
  { context: true },
)

// "const" case uses different type overload internally, but should work same for users.
myTest.concurrent.each([['hello', 2], ['hi', 3]] as const)(
  'array 3 context false %s %s',
  (...args) => {
    args satisfies [string, number]
    expect(args[0]).toBeTypeOf('string')
    expect(args[1]).toBeTypeOf('number')
  },
)

myTest.concurrent.each([['hello', 2], ['hi', 3]] as const)(
  'array 3 context true %s %s',
  async (argString, argNumber, { expect, myFixture }) => {
    argString satisfies string
    argNumber satisfies number
    await sleep(50)
    expect({ argString, argNumber, myFixture }).toMatchSnapshot()
    expect(argString).toBeTypeOf('string')
    expect(argNumber).toBeTypeOf('number')
  },
  { context: true },
)

// type is correct but it's not possible to access fixture
myTest.concurrent.each([['hello', 2], ['hi', 3]])(
  'array 4 context true %s %s',
  async (...args) => {
    args[0] satisfies string
    args[1] satisfies number
    args[2] satisfies { expect: unknown; myFixture: number }
    await sleep(50)
    expect(args[0]).toBeTypeOf('string')
    expect(args[1]).toBeTypeOf('number')
    args[2].expect({ argString: args[0], argNumber: args[1] }).toMatchSnapshot()
  },
  { context: true },
)

myTest.concurrent.each([
  [0, 1],
  [2, 3, 4],
])(
  'array 5 context false %s',
  async (...args) => {
    args satisfies number[]
    expect(args[0]).toBeTypeOf('number')
    expect(args[1]).toBeTypeOf('number')
  },
)

// user cannot access context for variablen length parameters
myTest.concurrent.each([
  [0, 1],
  [2, 3, 4],
])(
  'array 5 context true %s',
  async (...args) => {
    args satisfies unknown[]
    expect(args[0]).toBeTypeOf('number')
    expect(args[1]).toBeTypeOf('number')
  },
  { context: true },
)

myTest.concurrent.each`
  a          | b
  ${'hello'} | ${2}
  ${'hi'}    | ${3}
`(
  'template context false $a $b',
  async (...args) => {
    expectTypeOf(args).toEqualTypeOf<[any]>()
    expect(args[0].a).toBeTypeOf('string')
    expect(args[0].b).toBeTypeOf('number')
  },
)

myTest.concurrent.each`
  a          | b
  ${'hello'} | ${2}
  ${'hi'}    | ${3}
`(
  'template context true $a $b',
  async (arg, { expect, myFixture }) => {
    expectTypeOf(arg).toEqualTypeOf<any>()
    await sleep(50)
    expect({ arg, myFixture }).toMatchSnapshot()
  },
  { context: true },
)

test.concurrent.each([
  [1, 1],
  [2, 3],
])('docs example - add(%i, %i)', (a, b, { expect }) => {
  expect(a + b).toMatchSnapshot()
}, { context: true })

import { expect, expectTypeOf, test } from 'vitest'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const myTest = test.extend<{ myFixture: number }>({
  myFixture: async ({}, use) => {
    await use(1234)
  },
})

myTest.concurrent.each(['hello', 'hi'])(
  'myTest.each7-context-single-false %s',
  async (...args) => {
    await sleep(200)
    expect(args[0]).toBeTypeOf('string')
    args satisfies [string]
  },
)

myTest.concurrent.each(['hello', 'hi'])(
  'myTest.each7-context-single-true %s',
  async (arg, { expect, myFixture }) => {
    await sleep(200)
    expect({ arg, myFixture }).toMatchSnapshot()
  },
  { context: true },
)

myTest.concurrent.each([['hello'], ['hi']])(
  'myTest.each7-context-array-false %s',
  async (...args) => {
    await sleep(200)
    expect(args[0]).toBeTypeOf('string')
    args satisfies [string]
  },
)

myTest.concurrent.each([['hello'], ['hi']])(
  'myTest.each7-context-array-true %s',
  async (arg, { expect, myFixture }) => {
    await sleep(200)
    expect({ arg, myFixture }).toMatchSnapshot()
  },
  { context: true },
)

myTest.concurrent.each([['hello', 2], ['hi', 3]])(
  'myTest.each7-context-array-2-false %s %s',
  async (...args) => {
    await sleep(200)
    expect(args[0]).toBeTypeOf('string')
    expect(args[1]).toBeTypeOf('number')
    args satisfies [string, number]
  },
)

myTest.concurrent.each([['hello', 2], ['hi', 3]])(
  'myTest.each7-context-array-2-true %s %s',
  async (argString, argNumber, { expect, myFixture }) => {
    await sleep(200)
    expect({ argString, argNumber, myFixture }).toMatchSnapshot()
    expect(argString).toBeTypeOf('string')
    expect(argNumber).toBeTypeOf('number')
    argString satisfies string
    argNumber satisfies number
  },
  { context: true },
)

// "const" case uses different type overload internally, but should work same for users.
myTest.concurrent.each([['hello', 2], ['hi', 3]] as const)(
  'myTest.each7-context-array-3-false %s %s',
  (...args) => {
    expect(args[0]).toBeTypeOf('string')
    expect(args[1]).toBeTypeOf('number')
    args satisfies [string, number]
  },
)

myTest.concurrent.each([['hello', 2], ['hi', 3]] as const)(
  'myTest.each7-context-array-3-true %s %s',
  async (argString, argNumber, { expect, myFixture }) => {
    await sleep(200)
    expect({ argString, argNumber, myFixture }).toMatchSnapshot()
    expect(argString).toBeTypeOf('string')
    expect(argNumber).toBeTypeOf('number')
    argString satisfies string
    argNumber satisfies number
  },
  { context: true },
)

// type is correct but it's not possible to access fixture
myTest.concurrent.each([['hello', 2], ['hi', 3]])(
  'myTest.each7-context-array-2-spread-true %s %s',
  async (...args) => {
    args[0] satisfies string
    args[1] satisfies number
    args[2] satisfies { expect: unknown; myFixture: number }
    await sleep(200)
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
  'myTest.each7-context-array-var-false %s',
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
  'myTest.each7-context-array-var-true %s',
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
  'myTest.each7-context-template-false $a $b',
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
  'myTest.each7-context-template-true $a $b',
  async (arg, { expect, myFixture }) => {
    await sleep(200)
    expect({ arg, myFixture }).toMatchSnapshot()
  },
  { context: true },
)

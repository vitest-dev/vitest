import { expect, expectTypeOf, test } from 'vitest'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

test.concurrent.each3([['hello'], ['hi']])(
  'test.each3 %s',
  async ({ expect, args }) => {
    await sleep(200)
    expect(args[0]).toBeTypeOf('string')
    expect(args).toMatchSnapshot()
  },
)

;() => test.concurrent.each5([['hello'], ['hi']])(
  'test.each5-context-false %s',
  // @ts-expect-error no context
  async (arg, { expect }) => {
    await sleep(200)
    expect(arg).toBeTypeOf('string')
  },
)

test.concurrent.each5([['hello'], ['hi']])(
  'test.each5-context-false %s',
  async (arg) => {
    await sleep(200)
    expect(arg).toBeTypeOf('string')
  },
)

test.concurrent.each5([['hello'], ['hi']], { context: true })(
  'test.each5-context-true %s',
  async (arg, { expect }) => {
    await sleep(200)
    expect(arg).toBeTypeOf('string')
    expect(arg).toMatchSnapshot()
  },
)

const myTest = test.extend<{ myFixture: number }>({
  myFixture: async ({}, use) => {
    await use(1234)
  },
})

myTest.concurrent.each3([['hello'], ['hi']])(
  'myTest.each3 %s',
  async ({ expect, myFixture, args }) => {
    await sleep(200)
    expect({ args, myFixture }).toMatchSnapshot()
  },
)

;() => myTest.concurrent.each5([['hello'], ['hi']])(
  'myTest.each5-context-false %s',
  // @ts-expect-error no context
  async (arg, { expect }) => {
    await sleep(200)
    expect(arg).toBeTypeOf('string')
  },
)

myTest.concurrent.each5([['hello'], ['hi']])(
  'myTest.each5-context-false %s',
  async (arg) => {
    await sleep(200)
    expect(arg).toBeTypeOf('string')
  },
)

myTest.concurrent.each5([['hello'], ['hi']], { context: true })(
  'myTest.each5-context-true %s',
  async (arg, { expect, myFixture }) => {
    await sleep(200)
    expect({ arg, myFixture }).toMatchSnapshot()
  },
)

myTest.concurrent.each5([['hello', 2], ['hi', 3]])(
  'myTest.each5-context-false-multiple %s %s',
  async (argString, argNumber) => {
    await sleep(200)
    expect(argString).toBeTypeOf('string')
    expect(argNumber).toBeTypeOf('number')
    argString satisfies string
    argNumber satisfies number
  },
)

myTest.concurrent.each5([['hello', 2], ['hi', 3]])(
  'myTest.each5-context-false-multiple-spread %s %s',
  async (...args) => {
    await sleep(200)
    expect(args[0]).toBeTypeOf('string')
    expect(args[1]).toBeTypeOf('number')
    args[0] satisfies string
    args[1] satisfies number
  },
)

myTest.concurrent.each5([['hello'], ['hi']], { context: true })(
  'myTest.each5-context-true %s',
  async (arg, { expect, myFixture }) => {
    await sleep(200)
    expect({ arg, myFixture }).toMatchSnapshot()
  },
)

myTest.concurrent.each5([['hello', 2], ['hi', 3]], { context: true })(
  'myTest.each5-context-true-multiple %s %s',
  async (argString, argNumber, { expect, myFixture }) => {
    await sleep(200)
    expect({ argString, argNumber, myFixture }).toMatchSnapshot()
    expect(argString).toBeTypeOf('string')
    expect(argNumber).toBeTypeOf('number')
    argString satisfies string
    argNumber satisfies number
  },
)

// cannot support spread with context
;() => myTest.concurrent.each5([['hello', 2], ['hi', 3]], { context: true })(
  'myTest.each5-context-true-multiple-spread %s %s',
  async (...args) => {
    await sleep(200)
    expect(args[0]).toBeTypeOf('string')
    expect(args[1]).toBeTypeOf('number')
    args[0] satisfies string
    args[1] satisfies number
  },
)

//
// "context" flag as TestOpiton (3rd argument)
//

myTest.concurrent.each7(['hello', 'hi'])(
  'myTest.each7-context-single-false %s',
  async (...args) => {
    await sleep(200)
    expect(args[0]).toBeTypeOf('string')
    args satisfies [string]
  },
)

myTest.concurrent.each7(['hello', 'hi'])(
  'myTest.each7-context-single-true %s',
  async (arg, { expect, myFixture }) => {
    await sleep(200)
    expect({ arg, myFixture }).toMatchSnapshot()
  },
  { context: true },
)

myTest.concurrent.each7([['hello'], ['hi']])(
  'myTest.each7-context-array-false %s',
  async (...args) => {
    await sleep(200)
    expect(args[0]).toBeTypeOf('string')
    args satisfies [string]
  },
)

myTest.concurrent.each7([['hello'], ['hi']])(
  'myTest.each7-context-array-true %s',
  async (arg, { expect, myFixture }) => {
    await sleep(200)
    expect({ arg, myFixture }).toMatchSnapshot()
  },
  { context: true },
)

myTest.concurrent.each7([['hello', 2], ['hi', 3]])(
  'myTest.each7-context-array-2-false %s %s',
  async (...args) => {
    await sleep(200)
    expect(args[0]).toBeTypeOf('string')
    expect(args[1]).toBeTypeOf('number')
    args satisfies [string, number]
  },
)

myTest.concurrent.each7([['hello', 2], ['hi', 3]])(
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

// type is correct but it's not possible to access fixture
myTest.concurrent.each7([['hello', 2], ['hi', 3]])(
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

myTest.concurrent.each7([
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
myTest.concurrent.each7([
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

myTest.concurrent.each7`
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

myTest.concurrent.each7`
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

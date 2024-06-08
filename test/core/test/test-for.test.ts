import { expect, expectTypeOf, test } from 'vitest'

const myTest = test.extend<{ myFixture: number }>({
  myFixture: async ({}, use) => {
    await use(1234)
  },
})

test.for(['case1', 'case2'])(
  'basic %s',
  (args) => {
    expectTypeOf(args).toEqualTypeOf<string>()
    expect({ args }).matchSnapshot()
  },
)

myTest.for(['case1', 'case2'])(
  'fixture %s',
  (args, { myFixture }) => {
    expectTypeOf(args).toEqualTypeOf<string>()
    expectTypeOf(myFixture).toEqualTypeOf<number>()
    expect({ args, myFixture }).matchSnapshot()
  },
)

myTest.concurrent.for(['case1', 'case2'])(
  'concurrent %s',
  (args, { expect, myFixture }) => {
    expectTypeOf(args).toEqualTypeOf<string>()
    expectTypeOf(myFixture).toEqualTypeOf<number>()
    expect({ args, myFixture }).matchSnapshot()
  },
)

myTest.concurrent.for(['case1', 'case2'] as const)(
  'const %s',
  (args, { expect, myFixture }) => {
    expectTypeOf(args).toEqualTypeOf<'case1' | 'case2'>()
    expectTypeOf(myFixture).toEqualTypeOf<number>()
    expect({ args, myFixture }).matchSnapshot()
  },
)

myTest.concurrent.for([['case1-x', 'case1-y'], ['case2-x', 'case2-y']])(
  'array %s %s',
  (args, { expect, myFixture }) => {
    expectTypeOf(args).toEqualTypeOf<string[]>()
    expectTypeOf(myFixture).toEqualTypeOf<number>()
    expect({ args, myFixture }).matchSnapshot()
  },
)

myTest.concurrent.for([['case1-x', 'case1-y'], ['case2-x', 'case2-y']])(
  'array destructure %s %s',
  ([x, y], { expect, myFixture }) => {
    expectTypeOf(myFixture).toEqualTypeOf<number>()
    expect({ x, y, myFixture }).matchSnapshot()
  },
)

myTest.concurrent.for([{ k: 'case1' }, { k: 'case2' }])(
  'object $k',
  (args, { expect, myFixture }) => {
    expectTypeOf(args).toEqualTypeOf<{ k: string }>()
    expectTypeOf(myFixture).toEqualTypeOf<number>()
    expect({ args, myFixture }).matchSnapshot()
  },
)

myTest.concurrent.for([{ k: 'case1' }, { k: 'case2' }])(
  'object destructure $k',
  ({ k: v }, { expect, myFixture }) => {
    expectTypeOf(myFixture).toEqualTypeOf<number>()
    expect({ v, myFixture }).matchSnapshot()
  },
)

myTest.concurrent.for`
  a         | b
  ${'x'}    | ${true}
  ${'y'}    | ${false}
`(
  'template $a $b',
  (args, { expect, myFixture }) => {
    expectTypeOf(args).toEqualTypeOf<any>()
    expectTypeOf(myFixture).toEqualTypeOf<number>()
    expect({ args, myFixture }).toMatchSnapshot()
  },
)

test.concurrent.for([
  [1, 1],
  [1, 2],
  [2, 1],
])('[docs] add(%i, %i)', ([a, b], { expect }) => {
  expect(a + b).matchSnapshot()
})

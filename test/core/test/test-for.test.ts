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

myTest.concurrent.for([['case1-x', 'case1-y'], ['case2-x', 'case1-y']])(
  'array %s',
  (args, { expect, myFixture }) => {
    expectTypeOf(args).toEqualTypeOf<string[]>()
    expectTypeOf(myFixture).toEqualTypeOf<number>()
    expect({ args, myFixture }).matchSnapshot()
  },
)

myTest.concurrent.for([['case1-x', 'case1-y'], ['case2-x', 'case1-y']])(
  'array destructure %s',
  ([x, y], { expect, myFixture }) => {
    expectTypeOf(myFixture).toEqualTypeOf<number>()
    expect({ x, y, myFixture }).matchSnapshot()
  },
)

myTest.concurrent.for([{ k: 'case1' }, { k: 'case2' }])(
  'object %s',
  (args, { expect, myFixture }) => {
    expectTypeOf(args).toEqualTypeOf<{ k: string }>()
    expectTypeOf(myFixture).toEqualTypeOf<number>()
    expect({ args, myFixture }).matchSnapshot()
  },
)

myTest.concurrent.for([{ k: 'case1' }, { k: 'case2' }])(
  'object destructure %s',
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
  'template context false $a $b',
  (args, { expect, myFixture }) => {
    expectTypeOf(args).toEqualTypeOf<any>()
    expectTypeOf(myFixture).toEqualTypeOf<number>()
    expect({ args, myFixture }).toMatchSnapshot()
  },
)

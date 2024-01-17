import { expect, test } from 'vitest'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

test.concurrent.each2([['hello'], ['hi']])(
  'test.each2 %s',
  (...args) =>
    async ({ expect }) => {
      await sleep(200)
      expect(args[0]).toBeTypeOf('string')
      expect(args).toMatchSnapshot()
    },
)

test.concurrent.each3([['hello'], ['hi']])(
  'test.each3 %s',
  async ({ expect, args }) => {
    await sleep(200)
    expect(args[0]).toBeTypeOf('string')
    expect(args).toMatchSnapshot()
  },
)

test.concurrent.each4([['hello'], ['hi']])(
  'test.each4 %s',
  async (arg, { expect }) => {
    await sleep(200)
    expect(arg).toBeTypeOf('string')
    expect(arg).toMatchSnapshot()
  },
)

// type test
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

//
// with fixture
//

const myTest = test.extend<{ myFixture: number }>({
  myFixture: async ({}, use) => {
    await use(1234)
  },
})

myTest.concurrent.each2([['hello'], ['hi']])(
  'myTest.each2 %s',
  (...args) =>
    async ({ expect, myFixture }) => {
      await sleep(200)
      expect({ args, myFixture }).toMatchSnapshot()
    },
)

myTest.concurrent.each3([['hello'], ['hi']])(
  'myTest.each3 %s',
  async ({ expect, myFixture, args }) => {
    await sleep(200)
    expect({ args, myFixture }).toMatchSnapshot()
  },
)

myTest.concurrent.each4([['hello'], ['hi']])(
  'myTest.each4 %s',
  async (arg, { expect, myFixture }) => {
    await sleep(200)
    expect({ arg, myFixture }).toMatchSnapshot()
  },
)

// type test
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

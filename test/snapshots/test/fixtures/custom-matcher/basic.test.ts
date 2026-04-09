import { expect, test, Snapshots, chai } from 'vitest'

const {
  toMatchFileSnapshot,
  toMatchInlineSnapshot,
  toMatchSnapshot,
} = Snapshots

// custom snapshot matcher to wraper input code string
interface CustomMatchers<R = unknown> {
  toMatchCustomSnapshot: (properties?: object) => R
  toMatchCustomInlineSnapshot: (snapshot?: string) => R
  toMatchCustomFileSnapshot: (filepath: string) => Promise<R>
  toMatchCustomAsyncInlineSnapshot: (snapshot?: string) => Promise<R>
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
}

function formatCustom(input: string) {
  return {
    reversed: input.split('').reverse().join(''),
    length: input.length,
  }
}

expect.extend({
  toMatchCustomSnapshot(actual: string, properties?: object) {
    const actualCustom = formatCustom(actual)
    const result = toMatchSnapshot.call(this, actualCustom, properties)
    // result can be further enhanced
    return { ...result, message: () => `[custom error] ${result.message()}` }
  },
  toMatchCustomInlineSnapshot(
    actual: string,
    inlineSnapshot?: string,
  ) {
    const actualCustom = formatCustom(actual)
    const result = toMatchInlineSnapshot.call(this, actualCustom, inlineSnapshot)
    return { ...result, message: () => `[custom error] ${result.message()}` }
  },
  async toMatchCustomFileSnapshot(actual: string, filepath: string) {
    const actualCustom = formatCustom(actual)
    const result = await toMatchFileSnapshot.call(this, actualCustom, filepath)
    return { ...result, message: () => `[custom error] ${result.message()}` }
  },
  async toMatchCustomAsyncInlineSnapshot(
    actual: string,
    inlineSnapshot?: string,
  ) {
    chai.util.flag(this.assertion, 'error', new Error("__STACK_TRACE__"))
    await Promise.resolve()
    const inner = async () => {
      await Promise.resolve()
      const actualCustom = formatCustom(actual)
      const result = toMatchInlineSnapshot.call(this, actualCustom, inlineSnapshot)
      return { ...result, message: () => `[custom error] ${result.message()}` }
    }
    const result = await inner();
    return result;
  }
})

test('file', () => {
  expect(`hahaha`).toMatchCustomSnapshot()
})

test('properties 1', () => {
  expect(`popopo`).toMatchCustomSnapshot({ length: 6 })
})

test('properties 2', () => {
  expect(`pepepe`).toMatchCustomSnapshot({ length: expect.toSatisfy(function lessThan10(n) { return n < 10 }) })
})

test('raw', async () => {
  await expect(`hihihi`).toMatchCustomFileSnapshot('./__snapshots__/raw.txt')
})

test('inline', () => {
  expect(`hehehe`).toMatchCustomInlineSnapshot(`
    Object {
      "length": 6,
      "reversed": "eheheh",
    }
  `)
})

test('async inline', async () => {
  await expect(`huhuhu`).toMatchCustomAsyncInlineSnapshot(`
    Object {
      "length": 6,
      "reversed": "uhuhuh",
    }
  `)
})

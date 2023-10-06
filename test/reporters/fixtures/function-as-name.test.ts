import { describe, expect, test } from 'vitest'

function foo() {}
class Bar {}

describe(foo, () => {
  test(Bar, () => {
    expect(0).toBe(0)
  })
})

describe(Bar, () => {
  test(foo, () => {
    expect(0).toBe(0)
  })
})

describe(() => {}, () => {
  test(foo, () => {
    expect(0).toBe(0)
  })
})

describe(foo, () => {
  test(() => {}, () => {
    expect(0).toBe(0)
  })
})

describe.each([1])(foo, () => {
  test.each([1])(foo, () => {
    expect(0).toBe(0)
  })
})

describe.each([1])(Bar, () => {
  test.each([1])(Bar, () => {
    expect(0).toBe(0)
  })
})

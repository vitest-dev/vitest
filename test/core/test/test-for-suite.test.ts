import { describe, expect, expectTypeOf, test } from 'vitest'

describe.for(['case1', 'case2'])(
  'basic %s',
  (...args) => {
    test('test', () => {
      expectTypeOf(args).toEqualTypeOf<[string]>()
      expect({ args }).matchSnapshot()
    })
  },
)

describe.for`
  a         | b
  ${'x'}    | ${true}
  ${'y'}    | ${false}
`(
  'template $a $b',
  (...args) => {
    test('test', () => {
      expectTypeOf(args).toEqualTypeOf<any[]>()
      expect({ args }).toMatchSnapshot()
    })
  },
)

describe.for([
  [1, 1],
  [1, 2],
  [2, 1],
])('add(%i, %i)', ([a, b]) => {
  test('test', () => {
    expect(a + b).matchSnapshot()
  })
})

// Regression test: describe.concurrent.for should propagate the concurrent flag
// to the generated suites, matching how describe.for and test.concurrent.for behave.
describe.concurrent.for([1, 2, 3])('concurrent %i', item => {
  test('is marked concurrent', ({ task }) => {
    expect(task.suite!.concurrent).toBe(true)
    expect(item).toBeGreaterThan(0)
  })
})

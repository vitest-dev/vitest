import { expect, test, vi } from 'vitest'

import { MockedE } from '../src/mockedE'

vi.mock('../src/mockedE')

// this behavior looks odd but jest also doesn't seem to support this use case properly
test(`mocked class method not restorable`, () => {
  const instance1 = new MockedE()

  expect(instance1.testFn('a')).toMatchInlineSnapshot(`undefined`)
  expect(vi.mocked(instance1.testFn).mock.calls).toMatchInlineSnapshot(`
    [
      [
        "a",
      ],
    ]
  `)
  expect(vi.mocked(MockedE.prototype.testFn).mock.calls).toMatchInlineSnapshot(`
    [
      [
        "a",
      ],
    ]
  `)

  // restoring instance method
  vi.mocked(instance1.testFn).mockRestore()
  expect(instance1.testFn('b')).toMatchInlineSnapshot(`undefined`)
  expect(vi.mocked(instance1.testFn).mock.calls).toMatchInlineSnapshot(`
    [
      [
        "a",
      ],
      [
        "b",
      ],
    ]
  `)
  expect(vi.mocked(MockedE.prototype.testFn).mock.calls).toMatchInlineSnapshot(`
    [
      [
        "a",
      ],
      [
        "b",
      ],
    ]
  `)

  // restoring prototype doesn't restore instance
  vi.mocked(MockedE.prototype.testFn).mockRestore()
  expect(instance1.testFn('c')).toMatchInlineSnapshot(`undefined`)
  expect(vi.mocked(instance1.testFn).mock.calls).toMatchInlineSnapshot(`
    [
      [
        "c",
      ],
    ]
  `)
  expect(vi.mocked(MockedE.prototype.testFn).mock.calls).toMatchInlineSnapshot(`
    [
      [
        "c",
      ],
    ]
  `)
})

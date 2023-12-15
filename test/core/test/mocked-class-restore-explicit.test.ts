import { expect, test, vi } from 'vitest'

import { MockedE } from '../src/mockedE'

vi.mock('../src/mockedE')

// this behavior looks odd but jest also doesn't seem to support this use case properly
test(`mocked class methods are not restorable by explicit mockRestore calls`, () => {
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
  expect(vi.mocked(instance1.testFn).mock.calls).toMatchInlineSnapshot(`[]`)
  expect(vi.mocked(MockedE.prototype.testFn).mock.calls).toMatchInlineSnapshot(`
    [
      [
        "a",
      ],
    ]
  `)

  expect(instance1.testFn('b')).toMatchInlineSnapshot(`undefined`)
  expect(vi.mocked(instance1.testFn).mock.calls).toMatchInlineSnapshot(`
    [
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

  // restoring prototype method
  vi.mocked(MockedE.prototype.testFn).mockRestore()
  expect(vi.mocked(instance1.testFn).mock.calls).toMatchInlineSnapshot(`
    [
      [
        "b",
      ],
    ]
  `)
  expect(vi.mocked(MockedE.prototype.testFn).mock.calls).toMatchInlineSnapshot(`[]`)

  expect(instance1.testFn('c')).toMatchInlineSnapshot(`undefined`)
  expect(vi.mocked(instance1.testFn).mock.calls).toMatchInlineSnapshot(`
    [
      [
        "b",
      ],
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

import { expect, test, vi } from 'vitest'

import { MockedE } from '../src/mockedE'

vi.mock('../src/mockedE')

test(`mocked class are not affected by restoreAllMocks`, () => {
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

  vi.restoreAllMocks()
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
        "b",
      ],
    ]
  `)

  const instance2 = new MockedE()
  expect(instance2.testFn('c')).toMatchInlineSnapshot(`undefined`)
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
  expect(vi.mocked(instance2.testFn).mock.calls).toMatchInlineSnapshot(`
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
        "b",
      ],
      [
        "c",
      ],
    ]
  `)
})

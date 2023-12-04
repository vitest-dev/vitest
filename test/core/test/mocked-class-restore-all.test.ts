import { expect, test, vi } from 'vitest'

import { MockedE } from '../src/mockedE'

vi.mock('../src/mockedE')

test(`mocked class are not affected by restoreAllMocks`, () => {
  const instance0 = new MockedE()
  expect(instance0.testFn('a')).toMatchInlineSnapshot(`undefined`)
  expect(vi.mocked(instance0.testFn).mock.calls).toMatchInlineSnapshot(`
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

  // reset only history after restoreAllMocks
  expect(instance0.testFn('b')).toMatchInlineSnapshot(`undefined`)
  expect(vi.mocked(instance0.testFn).mock.calls).toMatchInlineSnapshot(`
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

  // mocked constructor is still effective after restoreAllMocks
  const instance1 = new MockedE()
  const instance2 = new MockedE()
  expect(instance1).not.toBe(instance2)
  expect(instance1.testFn).not.toBe(instance2.testFn)
  expect(instance1.testFn).not.toBe(MockedE.prototype.testFn)
  expect(vi.mocked(instance1.testFn).mock).not.toBe(vi.mocked(instance2.testFn).mock)

  expect(instance1.testFn('c')).toMatchInlineSnapshot(`undefined`)
  expect(vi.mocked(instance0.testFn).mock.calls).toMatchInlineSnapshot(`
    [
      [
        "b",
      ],
    ]
  `)
  expect(vi.mocked(instance1.testFn).mock.calls).toMatchInlineSnapshot(`
    [
      [
        "c",
      ],
    ]
  `)
  expect(vi.mocked(instance2.testFn).mock.calls).toMatchInlineSnapshot(`[]`)
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

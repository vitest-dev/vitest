import { expect, test, vi } from 'vitest'

import { MockedE, symbolFn } from '../src/mockedE'

vi.mock('../src/mockedE')

test(`each instance's methods of mocked class should have independent mock function state`, () => {
  const instance1 = new MockedE()
  const instance2 = new MockedE()
  expect(instance1).not.toBe(instance2)
  expect(instance1.testFn).not.toBe(instance2.testFn)
  expect(instance1.testFn).not.toBe(MockedE.prototype.testFn)
  expect(vi.mocked(instance1.testFn).mock).not.toBe(vi.mocked(instance2.testFn).mock)

  expect(instance1.testFn('a')).toMatchInlineSnapshot(`undefined`)
  expect(instance1.testFn).toBeCalledTimes(1)
  expect(instance2.testFn).toBeCalledTimes(0)
  expect(MockedE.prototype.testFn).toBeCalledTimes(1)
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

  expect(instance2.testFn('b')).toMatchInlineSnapshot(`undefined`)
  expect(instance1.testFn).toBeCalledTimes(1)
  expect(instance2.testFn).toBeCalledTimes(1)
  expect(MockedE.prototype.testFn).toBeCalledTimes(2)
  expect(vi.mocked(instance2.testFn).mock.calls).toMatchInlineSnapshot(`
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

  expect(instance1.testFn('c')).toMatchInlineSnapshot(`undefined`)
  expect(instance1.testFn).toBeCalledTimes(2)
  expect(instance2.testFn).toBeCalledTimes(1)
  expect(MockedE.prototype.testFn).toBeCalledTimes(3)
  expect(vi.mocked(instance1.testFn).mock.calls).toMatchInlineSnapshot(`
    [
      [
        "a",
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
      [
        "c",
      ],
    ]
  `)

  // test same things for symbol key method
  expect(instance1[symbolFn]).not.toBe(instance2[symbolFn])
  expect(instance1[symbolFn]).not.toBe(MockedE.prototype[symbolFn])
  expect(vi.mocked(instance1[symbolFn]).mock).not.toBe(vi.mocked(instance2[symbolFn]).mock)

  expect(instance1[symbolFn]('d')).toMatchInlineSnapshot(`undefined`)
  expect(instance1[symbolFn]).toBeCalledTimes(1)
  expect(instance2[symbolFn]).toBeCalledTimes(0)
  expect(MockedE.prototype[symbolFn]).toBeCalledTimes(1)
  expect(vi.mocked(instance1[symbolFn]).mock.calls).toMatchInlineSnapshot(`
    [
      [
        "d",
      ],
    ]
  `)
  expect(vi.mocked(instance2[symbolFn]).mock.calls).toMatchInlineSnapshot(`[]`)
  expect(vi.mocked(MockedE.prototype[symbolFn]).mock.calls).toMatchInlineSnapshot(`
    [
      [
        "d",
      ],
    ]
  `)
})

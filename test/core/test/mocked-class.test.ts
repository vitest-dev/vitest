import { expect, test, vi } from 'vitest'

import { MockedE } from '../src/mockedE'

vi.mock('../src/mockedE')

test(`each instance's methods of mocked class should have independent mock function state`, () => {
  const instance1 = new MockedE()
  const instance2 = new MockedE()
  expect(instance1).not.toBe(instance2)
  expect(instance1.testFn).not.toBe(instance2.testFn)
  expect(instance1.testFn).not.toBe(MockedE.prototype.testFn)
  expect(vi.mocked(instance1.testFn).mock).not.toBe(vi.mocked(instance2.testFn).mock)

  instance1.testFn('a')
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

  instance2.testFn('b')
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

  instance1.testFn('c')
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
})

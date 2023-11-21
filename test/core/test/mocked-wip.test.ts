import { expect, test, vi } from 'vitest'

import { MockedE } from '../src/mockedE'

vi.mock('../src/mockedE')

// TODO: move to mocked.test.ts?

test('mock each instance method separately', () => {
  expect(MockedE).toBeTypeOf('function')

  const instance1 = new MockedE()
  const instance2 = new MockedE()
  expect(instance1).not.toBe(instance2)
  expect(instance1.doSomething).not.toBe(instance2.doSomething)
  expect(instance1.doSomething).not.toBe(MockedE.prototype.doSomething)
  expect(vi.mocked(instance1.doSomething).mock).not.toBe(vi.mocked(instance2.doSomething).mock)

  // TODO: check input/output
  instance1.doSomething('a')
  expect(instance1.doSomething).toBeCalledTimes(1)
  expect(instance2.doSomething).toBeCalledTimes(0)
  expect(MockedE.prototype.doSomething).toBeCalledTimes(1)

  instance2.doSomething('b')
  expect(instance1.doSomething).toBeCalledTimes(1)
  expect(instance2.doSomething).toBeCalledTimes(1)
  expect(MockedE.prototype.doSomething).toBeCalledTimes(2)

  instance1.doSomething('c')
  expect(instance1.doSomething).toBeCalledTimes(2)
  expect(instance2.doSomething).toBeCalledTimes(1)
  expect(MockedE.prototype.doSomething).toBeCalledTimes(3)
})

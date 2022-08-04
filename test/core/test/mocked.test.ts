import { assert, describe, expect, test, vi, vitest } from 'vitest'
// @ts-expect-error not typed module
import { value as virtualValue } from 'virtual-module'
import { two } from '../src/submodule'
import * as mocked from '../src/mockedA'
import { mockedB } from '../src/mockedB'
import { MockedC, asyncFunc, exportedStream } from '../src/mockedC'
import * as globalMock from '../src/global-mock'

vitest.mock('../src/submodule')
vitest.mock('virtual-module', () => ({ value: 'mock' }))
vitest.mock('../src/mockedC')

test('submodule is mocked to return "two" as 3', () => {
  assert.equal(3, two)
})

test('globally mocked files are mocked', () => {
  // Mocked in setup.ts
  expect(globalMock.mocked).toBe(true)
})

test('can mock esm', () => {
  const spy = vi.spyOn(mocked, 'mockedA')

  mockedB()

  expect(spy).toHaveBeenCalled()
  expect(spy).toHaveReturnedWith('A')
})

test('mocked exports should override original exports', () => {
  expect(virtualValue).toBe('mock')
})

describe('mocked classes', () => {
  test('should not delete the prototype', () => {
    expect(MockedC).toBeTypeOf('function')
    expect(MockedC.prototype.doSomething).toBeTypeOf('function')
  })

  test('should mock the constructor', () => {
    const instance = new MockedC()

    expect(instance.value).not.toBe(42)
    expect(MockedC).toHaveBeenCalledOnce()
  })

  test('should mock functions in the prototype', () => {
    const instance = new MockedC()

    expect(instance.doSomething).toBeTypeOf('function')
    expect(instance.doSomething()).not.toBe('A')

    expect(MockedC.prototype.doSomething).toHaveBeenCalledOnce()
    expect(MockedC.prototype.doSomething).not.toHaveReturnedWith('A')
  })
})

test('async functions should be mocked', () => {
  expect(asyncFunc()).toBeUndefined()
  expect(vi.mocked(asyncFunc).mockResolvedValue).toBeDefined()
  vi.mocked(asyncFunc).mockResolvedValue('foo')
  expect(asyncFunc()).resolves.toBe('foo')
})

// This is here because mocking streams previously caused some problems (#1671).
test('streams', () => {
  expect(exportedStream).toBeDefined()
})

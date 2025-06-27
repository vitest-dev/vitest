import { describe, expect, test, vi } from 'vitest'
import * as mock from './fixtures/hello-mock'

/**
 * @vitest-environment happy-dom
 */

describe('spyOn', () => {
  const hw = new mock.HelloWorld()

  test('correctly infers method types', async () => {
    vi.spyOn(localStorage, 'getItem').mockReturnValue('world')
    expect(window.localStorage.getItem('hello')).toEqual('world')
  })

  test('infers a class correctly', () => {
    // eslint-disable-next-line prefer-arrow-callback
    vi.spyOn(mock, 'HelloWorld').mockImplementationOnce(function () {
      const Mock = vi.fn()
      Mock.prototype.hello = vi.fn(() => 'hello world')
      return new Mock()
    })

    const mockedHelloWorld = new mock.HelloWorld()
    expect(mockedHelloWorld.hello()).toEqual('hello world')
  })

  test('infers a method correctly', () => {
    vi.spyOn(hw, 'hello').mockImplementationOnce(() => 'hello world')

    expect(hw.hello()).toEqual('hello world')
  })

  test('spying copies properties from functions', () => {
    function a() {}
    a.HELLO_WORLD = true
    const obj = {
      a,
    }
    const spy = vi.spyOn(obj, 'a')
    expect(obj.a.HELLO_WORLD).toBe(true)
    expect((spy as any).HELLO_WORLD).toBe(true)
  })

  test('spying copies properties from classes', () => {
    class A {
      static HELLO_WORLD = true
    }
    const obj = {
      A,
    }
    const spy = vi.spyOn(obj, 'A')
    expect(obj.A.HELLO_WORLD).toBe(true)
    expect((spy as any).HELLO_WORLD).toBe(true)
  })
})

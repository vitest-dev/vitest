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
    vi.spyOn(mock, 'HelloWorld').mockImplementationOnce(() => {
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
})

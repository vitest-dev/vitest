import { describe, it, expect } from 'vitest'
import * as vitest from 'vitest'

describe('jest mock compat layer', () => {
  it('works with name', () => {
    const spy = vitest.fn()
    spy.mockName('spy test name')
    expect(spy.getMockName()).toBe('spy test name')
  })

  it('clearing', () => {
    const spy = vitest.fn()

    spy('hello')

    expect(spy.mock.calls).toHaveLength(1)
    expect(spy.mock.calls[0]).toEqual(['hello'])

    spy('world')

    expect(spy.mock.calls).toEqual([['hello'], ['world']])

    spy.mockReset() // same as mockClear()

    expect(spy.mock.calls).toEqual([])
  })

  const returnFactory = (type: string) => (value: any) => ({ type, value })

  const r = returnFactory('return')
  const t = returnFactory('throw')

  it('implementation sync fn', () => {
    const originalFn = function() {
      return 'original'
    }
    const spy = vitest.fn(originalFn)

    spy() // returns 'original'

    expect(spy.getMockImplementation()).toBe(undefined)

    spy.mockReturnValueOnce('2-once').mockReturnValueOnce('3-once')

    spy() // returns '2-once'
    spy() // returns '3-once'
    spy() // returns 'original'

    const implOnce = () => 'once'

    spy.mockImplementationOnce(implOnce)

    spy() // returns 'once'
    spy() // returns 'original'

    expect(spy.getMockImplementation() === implOnce).toBe(false) // jest doesnt store Once implementations

    const impl = () => 'unlimited'

    spy.mockImplementation(impl)

    spy() // returns 'unlimited'
    spy()
    spy()

    expect(spy.getMockImplementation() === impl).toBe(true)

    spy.mockReturnValue('return-unlimited')

    spy()
    spy()

    spy.mockRestore()

    spy() // returns 'original'

    expect(spy.getMockImplementation()).toBe(undefined)

    expect(spy.mock.results).toEqual([
      r('original'),
      r('2-once'),
      r('3-once'),
      r('original'),
      r('once'),
      r('original'),
      r('unlimited'),
      r('unlimited'),
      r('unlimited'),
      r('return-unlimited'),
      r('return-unlimited'),
      r('original'),
    ])
  })

  it.skip('implementation async fn', async() => {
    const originalFn = async function() {
      return 'original'
    }
    const spy = vitest.fn(originalFn)

    await spy() // returns 'original'

    // expect(spy.getMockImplementation()).toBe(undefined)

    spy
      .mockResolvedValue('unlimited')
      .mockResolvedValueOnce('3-once')
      .mockResolvedValueOnce('4-once')

    await spy()
    await spy()
    await spy()
    await spy()

    expect(spy.mock.results).toEqual([
      r('original'),
      r('unlimited'),
      r('3-once'),
      r('4-once'),
      r('unlimited'),
    ])
  })

  it.todo('method implementaitons with spyOn', () => {
    const obj = {
      fn: () => 'original',
    }

    const spy = vitest.spyOn(obj, 'fn')
  })

  it.skip('getter spyOn', () => {
    const obj = {
      get getter() {
        return 'original'
      },
    }

    const spy = vitest.spyOn(obj, 'getter', 'get')

    expect(obj.getter).toBe('original')

    spy.mockImplementation(() => 'mocked').mockImplementationOnce(() => 'once')

    expect(obj.getter).toBe('once')
    expect(obj.getter).toBe('mocked')
    expect(obj.getter).toBe('mocked')

    spy.mockReturnValue('returned').mockReturnValueOnce('returned-once')

    expect(obj.getter).toBe('returned-once')
    expect(obj.getter).toBe('returned')
    expect(obj.getter).toBe('returned')

    spy.mockRestore()

    // TODO fails for some reason
    expect(obj.getter).toBe('original')
  })

  it.skip('setter spyOn', () => {
    let settedValue = 'original'
    let mockedValue = 'none'

    const obj = {
      get setter() {
        return settedValue
      },
      set setter(v: any) {
        settedValue = v
      },
    }

    const spy = vitest.spyOn(obj, 'setter', 'set')

    obj.setter = 'first'

    expect(settedValue).toBe('first')
    expect(mockedValue).toBe('none')

    spy.mockImplementation(() => (mockedValue = 'mocked')).mockImplementationOnce(() => (mockedValue = 'once'))

    obj.setter = 'i can do whatever'
    expect(mockedValue).toBe('once')
    expect(settedValue).toBe('first')

    obj.setter = 'does nothing'
    expect(mockedValue).toBe('mocked')
    expect(settedValue).toBe('first')

    obj.setter = 'since setter is mocked'
    expect(mockedValue).toBe('mocked')
    expect(settedValue).toBe('first')

    spy.mockRestore()

    obj.setter = 'last'

    // TODO fails for some reason
    expect(settedValue).toBe('last')
  })
})

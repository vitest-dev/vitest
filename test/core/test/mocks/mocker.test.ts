import { expect, it } from 'vitest'
import { createMocker } from '../../../../packages/ui/node_modules/vitest/src/node/mocker'

it('Should not mock empty object', () => {
  const mocker = createMocker('root', {})
  const objectToMock = {}

  const result = mocker.mockObject(objectToMock)

  expect(result).toEqual({})
})

it('Should not mock object with primitive values', () => {
  const mocker = createMocker('root', {})
  const objectToMock = {
    item: 'anItem',
    aBoolean: true,
    aNumber: 1,
  }

  const result = mocker.mockObject(objectToMock)

  expect(result).toEqual({
    item: 'anItem',
    aBoolean: true,
    aNumber: 1,
  })
})

it('Should mock attribute with a function', () => {
  const mocker = createMocker('root', {})
  const objectToMock = {
    myFn: () => {},
  }

  const result = mocker.mockObject(objectToMock)

  expect(result).toEqual({
    myFn: expect.any(Function),
  })
  expect(result.myFn.mockClear).toBeDefined()
})

it('Should mock nested attribute with a function', () => {
  const mocker = createMocker('root', {})
  const objectToMock = {
    myAttr: {
      myFn: () => {},
    },
  }

  const result = mocker.mockObject(objectToMock)

  expect(result).toEqual({
    myAttr: {
      myFn: expect.any(Function),
    },
  })
  expect(result.myAttr.myFn.mockClear).toBeDefined()
})

it('Should mock function exported as a default with functions attributes', () => {
  // Ex axios
  // module.exports = axios
  // module.exports.default = axios
  const mocker = createMocker('root', {})
  const fn = () => {}
  fn.get = () => {}
  const objectToMock = {
    default: fn,
  }

  const result = mocker.mockObject(objectToMock)

  expect(result.default).toEqual(expect.any(Function))
  expect(result.default.get.mockClear).toBeDefined()
})

it('Should mock function exported as a default with functions attributes and circular references', () => {
  // Ex axios
  /*
    const obj = {
      item: 'anItem',
    }
    // Circular references
    obj.circular = obj
  */
  const mocker = createMocker('root', {})
  const fn = () => {}
  fn.get = () => {}
  fn.default = fn
  const objectToMock = {
    default: fn,
  }

  const result = mocker.mockObject(objectToMock)

  expect(result.default).toEqual(expect.any(Function))
  expect(result.default.get.mockClear).toBeDefined()
})
